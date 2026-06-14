import { STRUCTURE_TYPE_NAMES } from 'common/constants';
import type { PartComposition, PartDefinition } from 'domain/assessment/types';

// 第2次調査の判定対象部位（外部部位＋内部部位, FR-23）。
// @source FR-23（運用指針）。部位キーは正準。表示名は日本語。
export const PART_DEFINITIONS: PartDefinition[] = [
  { part: 'roof', displayName: '屋根' },
  { part: 'foundation', displayName: '基礎' },
  { part: 'exteriorWall', displayName: '外壁' },
  { part: 'ceiling', displayName: '天井' },
  { part: 'floor', displayName: '床' },
  { part: 'interiorWall', displayName: '内壁' },
  { part: 'fixtures', displayName: '建具' },
  { part: 'equipment', displayName: '設備' },
];

// 構造種別ごとの標準構成比(%)マスタ。各構造で合計=100%（BR-21, テストで検証）。
// @source FR-23（運用指針 水害編・記入の手引き）。
// 【重要 / Q3=A】下記は出典確定までの代表値プレースホルダ。実数値は docs/references 確定後に
// 本ファイルのみ差し替える（型・ロジック・PBT は不変）。
export const PART_COMPOSITION: Record<string, PartComposition> = {
  [STRUCTURE_TYPE_NAMES.wood]: {
    structureType: STRUCTURE_TYPE_NAMES.wood,
    parts: [
      { part: 'roof', compositionRatio: 15 },
      { part: 'foundation', compositionRatio: 15 },
      { part: 'exteriorWall', compositionRatio: 15 },
      { part: 'ceiling', compositionRatio: 10 },
      { part: 'floor', compositionRatio: 15 },
      { part: 'interiorWall', compositionRatio: 10 },
      { part: 'fixtures', compositionRatio: 10 },
      { part: 'equipment', compositionRatio: 10 },
    ],
  },
  [STRUCTURE_TYPE_NAMES.nonWood]: {
    structureType: STRUCTURE_TYPE_NAMES.nonWood,
    parts: [
      { part: 'roof', compositionRatio: 10 },
      { part: 'foundation', compositionRatio: 20 },
      { part: 'exteriorWall', compositionRatio: 20 },
      { part: 'ceiling', compositionRatio: 10 },
      { part: 'floor', compositionRatio: 10 },
      { part: 'interiorWall', compositionRatio: 10 },
      { part: 'fixtures', compositionRatio: 10 },
      { part: 'equipment', compositionRatio: 10 },
    ],
  },
};
