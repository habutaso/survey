import type { DAMAGE_LEVEL_LIST, STRUCTURE_TYPE_LIST } from 'common/constants';
import type { ExternalForceFlags, FloorRatio, PartDamage } from 'common/types/survey';

// 被害度区分（FR-24 / Q1・Q2=A）。値の真実の源は common/constants の DAMAGE_LEVEL_LIST。
export type DamageLevel = (typeof DAMAGE_LEVEL_LIST)[number];

type StructureType = (typeof STRUCTURE_TYPE_LIST)[number];

// 階按分の階別寄与（FR-28 / US-404）。
export type FloorContribution = {
  floor: number;
  areaRatio: number; // 階床面積比（%, 合計=100, BR-20）
  floorDamageRatio: number; // 当該階の損害割合（%）
};

// 階按分の根拠（按分前後, US-403）。
export type FloorApportionmentBasis = {
  applied: boolean;
  floors: FloorContribution[];
  ratioBefore: number; // 按分前の住家損害割合（%）
  ratioAfter: number; // 按分後の住家損害割合（%）
};

// 第2次: 部位別寄与の内訳（FR-23 / US-403）。
export type PartContributionDetail = {
  part: string;
  damageRatio: number; // 部位損傷率（%, 入力）
  compositionRatio: number; // 構成比（%, マスタ）
  contribution: number; // damageRatio × compositionRatio / 100（%寄与）
};

// 第1次の計算根拠（FR-20〜22 / US-403 / Q7=A）。
export type FirstAssessmentBasis = {
  surveyType: 'first';
  externalForceApplied: boolean; // 外力・流失等該当（true → 全壊確定, FR-20/BR-25）
  externalForceReasons: string[]; // 該当フラグ名
  tiltContribution: number | null; // 傾斜寄与（%, tiltTable 由来）
  inundationContribution: number | null; // 浸水深寄与（%, inundationDepthTable 由来）
  combinedRatio: number; // 階按分前の住家損害割合（%）
  floorBasis: FloorApportionmentBasis;
};

// 第2次の計算根拠（FR-23 / US-403 / Q7=A）。
export type SecondAssessmentBasis = {
  surveyType: 'second';
  structureType: StructureType; // 適用した構成比マスタ（Q4=A）
  partBreakdown: PartContributionDetail[];
  combinedRatio: number; // 階按分前の住家損害割合（%, partBreakdown 合計）
  floorBasis: FloorApportionmentBasis;
};

// 計算根拠（surveyType で判別する共用体, US-403）。
export type AssessmentBasis = FirstAssessmentBasis | SecondAssessmentBasis;

// 判定結果の正準型（Q5・Q6=A）。U2 common/types/survey は本型を再エクスポートする。
export type AssessmentResult = {
  damageRatio: number; // 損害割合（%, 小数第1位丸め後。0–100, FR-26）
  damageLevel: DamageLevel; // 6区分（FR-24）
  basis: AssessmentBasis;
};

// 第1次計算入力（FR-20〜22 / Q10=A）。common/types/survey の値オブジェクトを再利用。
export type FirstAssessmentInput = {
  externalForceFlags: ExternalForceFlags;
  tiltRatio: number | null;
  inundationDepthCm: number | null;
  floorApportionment: FloorRatio[] | null;
};

// 第2次計算入力（FR-23 / Q4=A）。
export type SecondAssessmentInput = {
  structureType: StructureType;
  partDamages: PartDamage[];
  floorApportionment: FloorRatio[] | null;
};
