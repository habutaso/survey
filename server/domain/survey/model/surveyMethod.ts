import { ROLE_NAMES } from 'common/constants';
import type { Role } from 'common/types/role';
import type { UserDto } from 'common/types/user';
import type {
  AssessmentResult,
  SurveyDetailDto,
  SurveyDto,
  SurveyStatus,
  SubmissionPayload,
} from 'common/types/survey';
import { brandedId } from 'common/validators/brandedId';
import { ForbiddenError, ValidationError } from 'service/customAssert';
import type { SurveyEntity } from './surveyType';

// 状態遷移アクション（FR-04）。reject は表に定義のみ・実装は後続（Q16=A）。
export type TransitionAction = 'approve' | 'confirm' | 'reject';

type TransitionRule = {
  from: SurveyStatus;
  action: TransitionAction;
  allowed: Role[];
  to: SurveyStatus;
};

// 許可遷移表（BR-7）。表外は既定拒否（fail closed）。confirmed は from に存在せず終端（INV-1）。
const TRANSITIONS: TransitionRule[] = [
  { from: 'submitted', action: 'approve', allowed: [ROLE_NAMES.admin], to: 'approved' },
  { from: 'approved', action: 'confirm', allowed: [ROLE_NAMES.admin], to: 'confirmed' },
  // reject（US-502, 後続）: 遷移定義のみ。UseCase/API 実装は後続フェーズ。
  { from: 'submitted', action: 'reject', allowed: [ROLE_NAMES.admin], to: 'draft' },
  { from: 'approved', action: 'reject', allowed: [ROLE_NAMES.admin], to: 'draft' },
];

// DTO（PII 含む詳細）→ エンティティ。id のみ EntityId へ再ブランド（他 ID は DtoId 共有）。
const toEntity = (dto: SurveyDetailDto): SurveyEntity => ({
  ...dto,
  id: brandedId.survey.entity.parse(dto.id),
});

// undefined → null 正規化（分岐集約でカバレッジ単純化）。
const orNull = <T>(value: T | undefined): T | null => value ?? null;

const firstDataFromPayload = (
  first: SubmissionPayload['firstSurvey'],
): SurveyEntity['first'] =>
  first === undefined
    ? null
    : {
        externalForceFlags: first.externalForceFlags,
        tiltRatio: orNull(first.tiltRatio),
        inundationDepthCm: orNull(first.inundationDepthCm),
        floorApportionment: orNull(first.floorApportionment),
      };

const secondDataFromPayload = (
  second: SubmissionPayload['secondSurvey'],
): SurveyEntity['second'] =>
  second === undefined
    ? null
    : {
        partDamages: second.partDamages,
        floorApportionment: orNull(second.floorApportionment),
      };

// ドメインロジック（純粋・L2 認可）。副作用は Date.now()/ulid 採番のみ（id はクライアント生成）。
export const surveyMethod = {
  // 提出ペイロードからエンティティ生成（status=submitted, 判定値は未設定 / Q1=A）。
  createFromSubmission: (actor: UserDto, payload: SubmissionPayload): SurveyEntity => {
    const now = Date.now();
    const s = payload.survey;

    return {
      id: brandedId.survey.entity.parse(s.id),
      surveyType: s.surveyType,
      parentSurveyId: orNull(s.parentSurveyId),
      status: 'submitted',
      address: s.address,
      houseNumber: s.houseNumber,
      structureType: s.structureType,
      buildingName: orNull(s.buildingName),
      floors: orNull(s.floors),
      latitude: orNull(s.latitude),
      longitude: orNull(s.longitude),
      victimName: orNull(s.victimName),
      victimContact: orNull(s.victimContact),
      victimAddress: orNull(s.victimAddress),
      damageRatio: null,
      damageLevel: null,
      assessmentBasis: null,
      officialSurveyId: null,
      officialChosenBy: null,
      officialChosenAt: null,
      createdBy: actor.id,
      createdTime: now,
      submittedAt: now,
      approvedBy: null,
      approvedAt: null,
      confirmedBy: null,
      confirmedAt: null,
      first: firstDataFromPayload(payload.firstSurvey),
      second: secondDataFromPayload(payload.secondSurvey),
    };
  },

  // 判定結果（assessmentPort 算出）をエンティティへ反映（Q5・Q6=A）。
  applyAssessment: (survey: SurveyEntity, result: AssessmentResult): SurveyEntity => ({
    ...survey,
    damageRatio: result.damageRatio,
    damageLevel: result.damageLevel,
    assessmentBasis: result.basis,
  }),

  // 状態遷移（表駆動）。不正遷移=ValidationError、ロール不足=ForbiddenError（fail closed, INV-1）。
  assertTransition: (current: SurveyStatus, action: TransitionAction, actor: UserDto): SurveyStatus => {
    const rule = TRANSITIONS.find((t) => t.from === current && t.action === action);

    if (rule === undefined) throw new ValidationError('不正な状態遷移です');
    if (!actor.roles.some((role) => rule.allowed.includes(role))) {
      throw new ForbiddenError('この操作を行う権限がありません');
    }

    return rule.to;
  },

  // 確定後不変（FR-05 / BR-8 / Q17=A）。あらゆる更新系の前に適用。
  assertMutable: (survey: Pick<SurveyDto, 'status'>): void => {
    if (survey.status === 'confirmed') throw new ForbiddenError('確定済みの調査は変更できません');
  },

  // 第2次の親検証（BR-5）。型不一致=ValidationError、未確定=ForbiddenError（不在は呼出側 NotFound）。
  assertReexaminationAllowed: (parent: Pick<SurveyDto, 'surveyType' | 'status'>): void => {
    if (parent.surveyType !== 'first') {
      throw new ValidationError('第2次調査の親は第1次調査である必要があります');
    }
    if (parent.status !== 'confirmed') {
      throw new ForbiddenError('親の第1次調査が確定されていません');
    }
  },

  // 正式判定対象の検証（BR-17/18）。対象外=ValidationError、未確定=ForbiddenError。
  assertOfficialTarget: (
    first: SurveyDto,
    secondList: SurveyDto[],
    officialSurveyId: SurveyDto['id'],
  ): void => {
    const target = [first, ...secondList].find((s) => s.id === officialSurveyId);

    if (target === undefined) {
      throw new ValidationError(
        '正式判定の対象は当該第1次調査またはその第2次調査である必要があります',
      );
    }
    if (target.status !== 'confirmed') {
      throw new ForbiddenError('正式判定の対象は確定済みである必要があります');
    }
  },

  // 承認（submitted→approved, admin）。確定後不変チェックは UseCase で実施。
  approve: (actor: UserDto, survey: SurveyDetailDto): SurveyEntity => {
    const status = surveyMethod.assertTransition(survey.status, 'approve', actor);

    return { ...toEntity(survey), status, approvedBy: actor.id, approvedAt: Date.now() };
  },

  // 確定（approved→confirmed, admin）。
  confirm: (actor: UserDto, survey: SurveyDetailDto): SurveyEntity => {
    const status = surveyMethod.assertTransition(survey.status, 'confirm', actor);

    return { ...toEntity(survey), status, confirmedBy: actor.id, confirmedAt: Date.now() };
  },

  // 正式判定の適用（第1次に official* を設定, BR-19）。確定後も設定可（判定内容は不変）。
  applyOfficial: (
    actor: UserDto,
    first: SurveyDetailDto,
    officialSurveyId: SurveyDto['id'],
  ): SurveyEntity => ({
    ...toEntity(first),
    officialSurveyId,
    officialChosenBy: actor.id,
    officialChosenAt: Date.now(),
  }),
};