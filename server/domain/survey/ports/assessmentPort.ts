import type { AssessmentResult, FirstSurveyData, SecondSurveyData } from 'common/types/survey';
import { computeFirstAssessment } from 'domain/assessment/computeFirstAssessment';
import { depend } from 'velona';

// 判定結果算出ポート（DI 境界 / Q5・Q6=A, NFR-09）。
// calcFirst は U3a で本実装（computeFirstAssessment）を既定 compute に束ねた。
// calcSecond は U2 由来の決定論的スタブ（damageRatio=0 / damageLevel='unclassified'）のまま、
// U3b が本実装を `depend` の dependency 差替で注入する（呼出点＝surveyUseCase.ingestSubmission は不変）。
// 入力（FirstSurveyData）は FirstAssessmentInput と構造同一、正準 AssessmentResult は緩い境界型へ widen 代入可能。
const UNCLASSIFIED = 'unclassified';

export const assessmentPort = {
  calcFirst: depend(
    { compute: computeFirstAssessment },
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