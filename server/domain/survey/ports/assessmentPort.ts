import type { SecondAssessmentInput } from 'common/types/assessment';
import type { AssessmentResult, FirstSurveyData } from 'common/types/survey';
import { computeFirstAssessment } from 'domain/assessment/computeFirstAssessment';
import { computeSecondAssessment } from 'domain/assessment/computeSecondAssessment';
import { depend } from 'velona';

// 判定結果算出ポート（DI 境界 / Q5・Q6=A, NFR-09）。
// calcFirst は U3a、calcSecond は U3b で本実装を既定 compute に束ねた。
// 呼出点（surveyUseCase.ingestSubmission → resolveAssessment）は不変。
// 入力（FirstSurveyData）は FirstAssessmentInput と構造同一。第2次は surveyDispatch が
// structureType を合成して SecondAssessmentInput を構成済み。正準 AssessmentResult は緩い境界型へ widen 代入可能。
export const assessmentPort = {
  calcFirst: depend(
    { compute: computeFirstAssessment },
    ({ compute }, input: FirstSurveyData): AssessmentResult => compute(input),
  ),
  calcSecond: depend(
    { compute: computeSecondAssessment },
    ({ compute }, input: SecondAssessmentInput): AssessmentResult => compute(input),
  ),
};