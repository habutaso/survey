import type { Prisma } from '@prisma/client';
import type {
  Pagination,
  SurveyDetailDto,
  SurveyDto,
  SurveyListFilter,
} from 'common/types/survey';
import { toSurveyDetailDto, toSurveyDto } from './toSurveyDto';

const include = { first: true, second: true } as const;

// 作成日時レンジ（純粋）。両端未指定なら undefined（Prisma は undefined を無視）。
const buildDateRange = (from?: number, to?: number): Prisma.DateTimeFilter | undefined =>
  from === undefined && to === undefined
    ? undefined
    : {
        ...(from !== undefined ? { gte: new Date(from) } : {}),
        ...(to !== undefined ? { lte: new Date(to) } : {}),
      };

// フィルタ → Prisma where（純粋, U5 / BR-U5-7）。confirmedOnly は status 未指定時のみ confirmed に展開。
// undefined 値は Prisma が無視するため条件分岐を増やさず素直に組み立てる。
export const buildSurveyWhere = (filter: SurveyListFilter): Prisma.SurveyWhereInput => ({
  status: filter.status ?? (filter.confirmedOnly === true ? 'confirmed' : undefined),
  surveyType: filter.surveyType,
  structureType: filter.structureType,
  damageLevel: filter.damageLevel,
  createdBy: filter.createdBy,
  address: filter.address === undefined ? undefined : { contains: filter.address, mode: 'insensitive' },
  createdAt: buildDateRange(filter.createdFrom, filter.createdTo),
});

export const surveyQuery = {
  // 詳細取得（PII 含む）。不在は findUniqueOrThrow が reject（呼出側で NotFound 化）。
  findDetailById: (tx: Prisma.TransactionClient, id: string): Promise<SurveyDetailDto> =>
    tx.survey.findUniqueOrThrow({ where: { id }, include }).then(toSurveyDetailDto),

  // 一覧・低権限用取得（PII 除外）。主に親第1次の区分/状態検証に利用。
  findById: (tx: Prisma.TransactionClient, id: string): Promise<SurveyDto> =>
    tx.survey.findUniqueOrThrow({ where: { id }, include }).then(toSurveyDto),

  // 第2次群取得（第1次:第2次=1:N, Q13=A）。
  listByParent: (tx: Prisma.TransactionClient, parentSurveyId: string): Promise<SurveyDto[]> =>
    tx.survey
      .findMany({ where: { parentSurveyId }, include, orderBy: { createdAt: 'desc' } })
      .then((rows) => rows.map(toSurveyDto)),

  // 第2次群の詳細取得（PII 含む, U5 PDF 家屋単位 / Q-U5-10=B）。admin のみが利用。
  listDetailByParent: (
    tx: Prisma.TransactionClient,
    parentSurveyId: string,
  ): Promise<SurveyDetailDto[]> =>
    tx.survey
      .findMany({ where: { parentSurveyId }, include, orderBy: { createdAt: 'desc' } })
      .then((rows) => rows.map(toSurveyDetailDto)),

  // 検索＋ページング（U5 / US-703 / Q-U5-4=A）。PII 除外。items と総件数を返す。
  search: async (
    tx: Prisma.TransactionClient,
    filter: SurveyListFilter,
    pagination: Pagination,
  ): Promise<{ items: SurveyDto[]; total: number }> => {
    const where = buildSurveyWhere(filter);
    const [rows, total] = await Promise.all([
      tx.survey.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      tx.survey.count({ where }),
    ]);

    return { items: rows.map(toSurveyDto), total };
  },

  // CSV 用・詳細（PII 含む）・全件・ページングなし（U5 / US-702 / Q-U5-7=A）。
  searchDetail: (
    tx: Prisma.TransactionClient,
    filter: SurveyListFilter,
  ): Promise<SurveyDetailDto[]> =>
    tx.survey
      .findMany({ where: buildSurveyWhere(filter), include, orderBy: { createdAt: 'desc' } })
      .then((rows) => rows.map(toSurveyDetailDto)),
};