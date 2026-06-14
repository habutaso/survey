import type { AssessmentResult, FirstSurveyData, SecondSurveyData } from 'common/types/survey';
import { depend } from 'velona';

// 判定結果算出ポート（DI 境界 / Q5・Q6=A, NFR-09）。
// U2 は決定論的スタブ（damageRatio=0 / damageLevel='unclassified'）を既定実装とする。
// U3a が calcFirst、U3b が calcSecond の本実装を `depend` の dependency 差替で注入する
// （呼出点＝surveyUseCase.ingestSubmission は不変）。入力には floorApportionment を内包する。
const UNCLASSIFIED = 'unclassified';

export const assessmentPort = {
  calcFirst: depend(
    {
      compute: (_input: FirstSurveyData): AssessmentResult => ({
        damageRatio: 0,
        damageLevel: UNCLASSIFIED,
        basis: { stub: true, unit: 'first' },
      }),
    },
    ({ compute }, input: FirstSurveyData): AssessmentResult => compute(input),
  ),
  calcSecond: depend(
    {
      compute: (_input: SecondSurveyData): AssessmentResult => ({
        damageRatio: 0,
        damageLevel: UNCLASSIFIED,
        basis: { stub: true, unit: 'second' },
      }),
    },
    ({ compute }, input: SecondSurveyData): AssessmentResult => compute(input),
  ),
};