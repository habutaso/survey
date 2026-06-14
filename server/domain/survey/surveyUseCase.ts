import type { Prisma } from '@prisma/client';
import type { DtoId } from 'common/types/brandedId';
import type {
  AssessmentResult,
  HouseResultsDto,
  SubmissionPayload,
  SurveyDetailDto,
  SurveyDto,
} from 'common/types/survey';
import type { UserDto } from 'common/types/user';
import type { AuditEvent } from 'domain/audit/model/auditMethod';
import { auditUseCase } from 'domain/audit/auditUseCase';
import { NotFoundError } from 'service/customAssert';
import { prismaClient, transaction } from 'service/prismaClient';
import { depend } from 'velona';
import { surveyAudit } from './model/surveyAudit';
import { surveyDispatch } from './model/surveyDispatch';
import { surveyMethod } from './model/surveyMethod';
import { surveyPolicy } from './model/surveyPolicy';
import type { SurveyEntity } from './model/surveyType';
import { assessmentPort } from './ports/assessmentPort';
import { photoPort } from './ports/photoPort';
import { surveyCommand } from './store/surveyCommand';
import { surveyQuery } from './store/surveyQuery';

type Ports = { assessmentPort: typeof assessmentPort; photoPort: typeof photoPort };

const notFound = (): Promise<never> => Promise.reject(new NotFoundError('調査が見つかりません'));

// 判定結果の算出（区分別ポート呼出）。区分判定は surveyDispatch（純粋）に委譲。
const resolveAssessment = (ports: Ports, entity: SurveyEntity): AssessmentResult => {
  const input = surveyDispatch.assessmentInput(entity);

  return 'first' in input
    ? ports.assessmentPort.calcFirst(input.first)
    : ports.assessmentPort.calcSecond(input.second);
};

// 第2次の親検証（BR-5）。第1次はスキップ。親 ID 抽出は surveyDispatch（純粋）に委譲。
const assertSecondParent = async (
  tx: Prisma.TransactionClient,
  entity: SurveyEntity,
): Promise<void> => {
  const parentId = surveyDispatch.requireParent(entity);

  if (parentId === null) return;

  const parent = await surveyQuery
    .findById(tx, parentId)
    .catch(() => Promise.reject(new NotFoundError('親の第1次調査が見つかりません')));

  surveyMethod.assertReexaminationAllowed(parent);
};

// 同一トランザクションで監査イベントを順次記録（U-Cross 規約・順序保証）。
const recordAll = async (tx: Prisma.TransactionClient, events: AuditEvent[]): Promise<void> => {
  for (const event of events) await auditUseCase.record(tx, event);
};

export const surveyUseCase = {
  // 提出時一括同期（US-207 / FR-18・19）。冪等・原子的。ポートは DI（U2 はスタブ既定）。
  ingestSubmission: depend(
    { assessmentPort, photoPort },
    (ports, actor: UserDto, payload: SubmissionPayload): Promise<SurveyDetailDto> =>
      transaction('RepeatableRead', async (tx) => {
        surveyPolicy.assertSubmitter(actor);

        const existing = await surveyQuery.findDetailById(tx, payload.survey.id).catch(() => null);

        if (existing !== null) surveyMethod.assertMutable(existing); // confirmed 再送は拒否（BR-15c）

        const base = surveyMethod.createFromSubmission(actor, payload);

        await assertSecondParent(tx, base);

        const entity = surveyMethod.applyAssessment(base, resolveAssessment(ports, base));
        const saved = await surveyCommand.upsert(tx, entity);

        ports.photoPort.persist(tx, saved.id, payload.photos ?? []);

        await recordAll(tx, surveyAudit.submitEvents(actor, existing, saved));

        return saved;
      }),
  ),

  // 承認（admin / submitted→approved, US-503）。
  approve: (actor: UserDto, surveyId: DtoId['survey']): Promise<SurveyDetailDto> =>
    transaction('RepeatableRead', async (tx) => {
      surveyPolicy.assertApprover(actor);

      const survey = await surveyQuery.findDetailById(tx, surveyId).catch(notFound);

      surveyMethod.assertMutable(survey);

      const saved = await surveyCommand.upsert(tx, surveyMethod.approve(actor, survey));

      await recordAll(tx, [surveyAudit.statusEvent(actor, 'survey.approve', survey, saved)]);

      return saved;
    }),

  // 確定（admin / approved→confirmed, US-504）。既 confirmed は no-op 成功（冪等, PBT-04）。
  confirm: (actor: UserDto, surveyId: DtoId['survey']): Promise<SurveyDetailDto> =>
    transaction('RepeatableRead', async (tx) => {
      surveyPolicy.assertApprover(actor);

      const survey = await surveyQuery.findDetailById(tx, surveyId).catch(notFound);

      if (survey.status === 'confirmed') return survey;

      const saved = await surveyCommand.upsert(tx, surveyMethod.confirm(actor, survey));

      await recordAll(tx, [surveyAudit.statusEvent(actor, 'survey.confirm', survey, saved)]);

      return saved;
    }),

  // 正式判定（admin, US-606）。第1次に official* を設定。確定後も設定可（BR-19）。
  chooseOfficial: (
    actor: UserDto,
    firstSurveyId: DtoId['survey'],
    officialSurveyId: DtoId['survey'],
  ): Promise<SurveyDetailDto> =>
    transaction('RepeatableRead', async (tx) => {
      surveyPolicy.assertApprover(actor);

      const first = await surveyQuery.findDetailById(tx, firstSurveyId).catch(notFound);
      const seconds = await surveyQuery.listByParent(tx, firstSurveyId);

      surveyMethod.assertOfficialTarget(first, seconds, officialSurveyId);

      const saved = await surveyCommand.upsert(
        tx,
        surveyMethod.applyOfficial(actor, first, officialSurveyId),
      );

      await recordAll(tx, [surveyAudit.officialEvent(actor, first, saved, officialSurveyId)]);

      return saved;
    }),

  // 詳細取得。PII は surveyor/admin のみ、viewer はマスク（BR-13）。
  get: async (actor: UserDto, surveyId: DtoId['survey']): Promise<SurveyDetailDto> => {
    const detail = await surveyQuery.findDetailById(prismaClient, surveyId).catch(notFound);

    if (surveyPolicy.canViewPii(actor)) return detail;

    return surveyPolicy.maskPii(detail);
  },

  // 全件読取（PII 除外, Q19=A）。本格検索/ページングは U5。
  list: (): Promise<SurveyDto[]> => surveyQuery.list(prismaClient),

  // 第1次＋第2次群の結果併記（US-605）。PII 除外。
  getHouseResults: async (firstSurveyId: DtoId['survey']): Promise<HouseResultsDto> => {
    const first = await surveyQuery.findById(prismaClient, firstSurveyId).catch(notFound);
    const seconds = await surveyQuery.listByParent(prismaClient, firstSurveyId);

    return { first, seconds };
  },
};