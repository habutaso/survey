import type { SecondAssessmentInput } from 'common/types/assessment';
import type { DtoId } from 'common/types/brandedId';
import type { FirstSurveyData } from 'common/types/survey';
import { ValidationError } from 'service/customAssert';
import type { SurveyEntity } from './surveyType';

// 区分ディスパッチ（純粋）。エンティティから算出入力・親 ID を安全に取り出す。
export const surveyDispatch = {
  // 区分別の判定入力（INV-4 / fail closed）。区分従属データ未設定は不正。
  // 第2次は structureType（SurveyCommon）を second データへ合成し SecondAssessmentInput を構成（U3b）。
  assessmentInput: (
    entity: SurveyEntity,
  ): { first: FirstSurveyData } | { second: SecondAssessmentInput } => {
    if (entity.first !== null) return { first: entity.first };
    if (entity.second !== null) {
      return {
        second: {
          structureType: entity.structureType,
          partDamages: entity.second.partDamages,
          floorApportionment: entity.second.floorApportionment,
        },
      };
    }
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