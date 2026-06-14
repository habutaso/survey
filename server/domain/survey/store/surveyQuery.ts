import type { Prisma } from '@prisma/client';
import type { SurveyDetailDto, SurveyDto } from 'common/types/survey';
import { toSurveyDetailDto, toSurveyDto } from './toSurveyDto';

const include = { first: true, second: true } as const;

export const surveyQuery = {
  // 詳細取得（PII 含む）。不在は findUniqueOrThrow が reject（呼出側で NotFound 化）。
  findDetailById: (tx: Prisma.TransactionClient, id: string): Promise<SurveyDetailDto> =>
    tx.survey.findUniqueOrThrow({ where: { id }, include }).then(toSurveyDetailDto),

  // 一覧・低権限用取得（PII 除外）。主に親第1次の区分/状態検証に利用。
  findById: (tx: Prisma.TransactionClient, id: string): Promise<SurveyDto> =>
    tx.survey.findUniqueOrThrow({ where: { id }, include }).then(toSurveyDto),

  // 全件読取（Q19=A）。本格的な検索/ページングは U5。
  list: (tx: Prisma.TransactionClient): Promise<SurveyDto[]> =>
    tx.survey
      .findMany({ include, orderBy: { createdAt: 'desc' } })
      .then((rows) => rows.map(toSurveyDto)),

  // 第2次群取得（第1次:第2次=1:N, Q13=A）。
  listByParent: (tx: Prisma.TransactionClient, parentSurveyId: string): Promise<SurveyDto[]> =>
    tx.survey
      .findMany({ where: { parentSurveyId }, include, orderBy: { createdAt: 'desc' } })
      .then((rows) => rows.map(toSurveyDto)),
};