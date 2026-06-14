import type {
  AssessmentResult,
  PartContributionDetail,
  SecondAssessmentBasis,
  SecondAssessmentInput,
} from 'common/types/assessment';
import type { PartDamage } from 'common/types/survey';
import { applyFloorRatio } from 'domain/assessment/applyFloorRatio';
import { classifyDamageLevel } from 'domain/assessment/classifyDamageLevel';
import { PART_COMPOSITION } from 'domain/assessment/constants/partComposition';
import type { PartComposition } from 'domain/assessment/types';
import { clampRatio, roundRatio } from 'domain/assessment/round';
import { customAssert, ValidationError } from 'service/customAssert';

// 構成比マスタを部位→構成比(%) の Map へ変換。
const toCompositionMap = (composition: PartComposition): Map<string, number> =>
  new Map(composition.parts.map((p) => [p.part, p.compositionRatio]));

// 部位別寄与（損傷率 × 構成比 / 100, FR-23）。未定義部位・範囲外は ValidationError（BR-26・29）。
const toContribution = (pd: PartDamage, ratioByPart: Map<string, number>): PartContributionDetail => {
  const compositionRatio = ratioByPart.get(pd.part);
  if (compositionRatio === undefined) {
    throw new ValidationError(`unknown survey part: ${pd.part}`);
  }
  if (pd.damageRatio < 0 || pd.damageRatio > 100) {
    throw new ValidationError(`part damage ratio out of range: ${pd.damageRatio}`);
  }
  return {
    part: pd.part,
    damageRatio: pd.damageRatio,
    compositionRatio,
    contribution: (pd.damageRatio * compositionRatio) / 100,
  };
};

// 第2次調査の判定（FR-23 / Q4=A / US-402・403・404）。
export const computeSecondAssessment = (input: SecondAssessmentInput): AssessmentResult => {
  const composition = PART_COMPOSITION[input.structureType];
  customAssert(composition, `unknown structure type: ${input.structureType}`);
  const ratioByPart = toCompositionMap(composition);
  const partBreakdown = input.partDamages.map((pd) => toContribution(pd, ratioByPart));
  const combinedRatio = clampRatio(partBreakdown.reduce((acc, d) => acc + d.contribution, 0));
  const { ratioAfter, basis: floorBasis } = applyFloorRatio(combinedRatio, input.floorApportionment);
  const damageRatio = roundRatio(ratioAfter);
  const basis: SecondAssessmentBasis = {
    surveyType: 'second',
    structureType: input.structureType,
    partBreakdown,
    combinedRatio,
    floorBasis,
  };
  return { damageRatio, damageLevel: classifyDamageLevel(damageRatio), basis };
};
