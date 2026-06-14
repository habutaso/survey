import type { DtoId } from 'common/types/brandedId';
import type { FirstSurveyData, SecondSurveyData } from 'common/types/survey';
import { ValidationError } from 'service/customAssert';
import type { SurveyEntity } from './surveyType';

// 区分ディスパッチ（純粋）。エンティティから算出入力・親 ID を安全に取り出す。
export const surveyDispatch = {
  // 区分別の判定入力（INV-4 / fail closed）。区分従属データ未設定は不正。
  assessmentInput: (
    entity: SurveyEntity,
  ): { first: FirstSurveyData } | { second: SecondSurveyData } => {
    if (entity.first !== null) return { first: entity.first };
    if (entity.second !== null) return { second: entity.second };
    throw new ValidationError('調査区分の入力がありません');
  },

  // 第2次の親 ID 要求（BR-4/5）。第1次は null、第2次で親未指定は不正。
  requireParent: (entity: SurveyEntity): DtoId['survey'] | null => {
    if (entity.surveyType !== 'second') return null;
    if (entity.parentSurveyId === null) {
      throw new ValidationError('第2次調査には親調査IDが必要です');
    }

    return entity.parentSurveyId;
  },
};