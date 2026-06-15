import type { DtoId } from 'common/types/brandedId';
import type { ExportTicket, SurveyCsvRow, SurveyPdfModel } from 'common/types/export';
import type { SurveyListFilter } from 'common/types/survey';
import type { UserDto } from 'common/types/user';
import { auditUseCase } from 'domain/audit/auditUseCase';
import { surveyPolicy } from 'domain/survey/model/surveyPolicy';
import { surveyQuery } from 'domain/survey/store/surveyQuery';
import { NotFoundError } from 'service/customAssert';
import { pdfRenderer } from 'service/pdfRenderer';
import { prismaClient } from 'service/prismaClient';
import { s3 } from 'service/s3Client';
import { depend } from 'velona';
import { csvRenderer } from './model/csvRenderer';
import { exportFormat } from './model/exportFormat';

// presigned GET の有効期限（U5 / BR-U5-10, 短命 15 分）。
const PRESIGN_EXPIRES_SEC = 15 * 60;

// 結果出力（U5）。PDF/CSV をサーバ生成し S3 保存→presigned URL を返す（Q-U5-8=B）。
// 副作用（生成・S3・時刻）は velona depend で注入しテスト可能にする。
export const exportUseCase = {
  // 家屋単位 PDF（Q-U5-6=C admin のみ / Q-U5-10=B 第1次＋第2次群）。
  buildSurveyPdf: depend(
    {
      renderPdf: (model: SurveyPdfModel): Promise<Buffer> => pdfRenderer.renderSurveyPdf(model),
      putBuffer: s3.putBuffer,
      signGet: s3.getSignedUrl,
      now: (): number => Date.now(),
    },
    async (
      { renderPdf, putBuffer, signGet, now },
      actor: UserDto,
      firstSurveyId: DtoId['survey'],
    ): Promise<ExportTicket> => {
      surveyPolicy.assertExporter(actor); // admin のみ（BR-U5-2, fail closed）

      const first = await surveyQuery
        .findDetailById(prismaClient, firstSurveyId)
        .catch(() => Promise.reject(new NotFoundError('第1次調査が見つかりません')));

      // ID は第1次調査 ID 必須（BR-U5-11）。第2次 ID 指定は 404。
      if (first.surveyType !== 'first') throw new NotFoundError('第1次調査が見つかりません');

      const seconds = await surveyQuery.listDetailByParent(prismaClient, firstSurveyId);
      const buffer = await renderPdf(exportFormat.toPdfModel(first, seconds));
      const at = now();
      const key = `exports/pdf/${firstSurveyId}-${at}.pdf`;

      await putBuffer(key, buffer, 'application/pdf');

      const url = await signGet(key, PRESIGN_EXPIRES_SEC);

      await auditUseCase.record(prismaClient, {
        actorUserId: actor.id,
        action: 'export.pdf',
        targetType: 'survey',
        targetId: firstSurveyId,
        summary: `PDF出力（第2次 ${seconds.length} 件併記）`,
      });

      return { format: 'pdf', url, filename: `survey-${firstSurveyId}.pdf`, expiresInSec: PRESIGN_EXPIRES_SEC };
    },
  ),

  // 複数件 CSV（Q-U5-7=A admin のみ・PII 含む）。フィルタ該当全件・ページングなし。
  buildSurveyCsv: depend(
    {
      renderCsv: (rows: SurveyCsvRow[]): Buffer => csvRenderer.render(rows),
      putBuffer: s3.putBuffer,
      signGet: s3.getSignedUrl,
      now: (): number => Date.now(),
    },
    async (
      { renderCsv, putBuffer, signGet, now },
      actor: UserDto,
      filter: SurveyListFilter,
    ): Promise<ExportTicket> => {
      surveyPolicy.assertExporter(actor); // admin のみ（BR-U5-3, fail closed）

      const details = await surveyQuery.searchDetail(prismaClient, filter);
      const rows = exportFormat.toCsvRows(details);
      const buffer = renderCsv(rows);
      const at = now();
      const key = `exports/csv/${actor.id}-${at}.csv`;

      await putBuffer(key, buffer, 'text/csv');

      const url = await signGet(key, PRESIGN_EXPIRES_SEC);

      await auditUseCase.record(prismaClient, {
        actorUserId: actor.id,
        action: 'export.csv',
        targetType: 'survey',
        summary: `CSV出力 ${rows.length} 件`,
      });

      return { format: 'csv', url, filename: `surveys-${at}.csv`, expiresInSec: PRESIGN_EXPIRES_SEC };
    },
  ),
};
