import type { AssessmentResult, FirstAssessmentBasis, FirstAssessmentInput } from 'common/types/assessment';
import type { ExternalForceFlags } from 'common/types/survey';
import { applyFloorRatio } from 'domain/assessment/applyFloorRatio';
import { classifyDamageLevel } from 'domain/assessment/classifyDamageLevel';
import { INUNDATION_DEPTH_TABLE } from 'domain/assessment/constants/inundationDepthTable';
import { TILT_TABLE } from 'domain/assessment/constants/tiltTable';
import { lookupBandRatio } from 'domain/assessment/lookupBandRatio';
import { clampRatio, roundRatio } from 'domain/assessment/round';

// 外力・流失等フラグのキー（FR-20 / BR-25）。いずれか true → 全壊確定。
const EXTERNAL_FORCE_KEYS = [
  'houseWashedAway',
  'groundScour',
  'foundationWashout',
  'fullCeilingInundation',
] as const;

// 該当する外力フラグ名の一覧。
const collectExternalForceReasons = (flags: ExternalForceFlags): string[] =>
  EXTERNAL_FORCE_KEYS.filter((key) => flags[key]);

// 傾斜・浸水深の損害割合寄与（未入力は null, BR-24・27）。
const firstContributions = (
  input: FirstAssessmentInput,
): { tiltContribution: number | null; inundationContribution: number | null } => ({
  tiltContribution: input.tiltRatio === null ? null : lookupBandRatio(input.tiltRatio, TILT_TABLE),
  inundationContribution:
    input.inundationDepthCm === null
      ? null
      : lookupBandRatio(input.inundationDepthCm, INUNDATION_DEPTH_TABLE),
});

// 寄与合算（既定方式: 加算→[0,100]クランプ, BR-24。実数値・合成方式は Q3=A で差替可能）。
const sumContributions = (tilt: number | null, inundation: number | null): number =>
  clampRatio((tilt ?? 0) + (inundation ?? 0));

// 第1次調査の判定（FR-20〜22 / Q10=A / US-402・403・404）。
export const computeFirstAssessment = (input: FirstAssessmentInput): AssessmentResult => {
  const reasons = collectExternalForceReasons(input.externalForceFlags);
  const externalForceApplied = reasons.length > 0;
  const { tiltContribution, inundationContribution } = firstContributions(input);
  const combinedRatio = externalForceApplied
    ? 100
    : sumContributions(tiltContribution, inundationContribution);
  const { ratioAfter, basis: floorBasis } = applyFloorRatio(
    combinedRatio,
    externalForceApplied ? null : input.floorApportionment,
  );
  const damageRatio = roundRatio(ratioAfter);
  const basis: FirstAssessmentBasis = {
    surveyType: 'first',
    externalForceApplied,
    externalForceReasons: reasons,
    tiltContribution,
    inundationContribution,
    combinedRatio,
    floorBasis,
  };
  return { damageRatio, damageLevel: classifyDamageLevel(damageRatio), basis };
};
