import type { STRUCTURE_TYPE_LIST } from 'common/constants';
import type { DamageLevel } from 'common/types/assessment';

type StructureType = (typeof STRUCTURE_TYPE_LIST)[number];

// 6区分閾値（FR-24 確定値）。下限包含・上限排他。
export type DamageLevelThreshold = {
  level: DamageLevel;
  minInclusive: number; // 下限（包含）
  maxExclusive: number | null; // 上限（排他）。totalCollapse は null（上限なし）
};

// 部位定義（FR-23）。
export type PartDefinition = {
  part: string;
  displayName: string;
};

// 構造種別ごとの部位構成比マスタ（FR-23 / Q4=A）。合計=100%（BR-21）。
export type PartComposition = {
  structureType: StructureType;
  parts: { part: string; compositionRatio: number }[];
};

// 換算帯（値→損害割合）。第1次の浸水深・傾斜換算で共有（FR-21・FR-22）。
// lower 包含・upper 排他。最上位帯の upper は null（上限なし）。
export type ConversionBand = {
  lower: number; // 下限（包含）。浸水深(cm) / 傾斜割合
  upper: number | null; // 上限（排他）。最上位は null
  damageRatio: number; // 当該帯の損害割合（%）
};
