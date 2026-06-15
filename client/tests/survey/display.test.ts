import {
  damageLevelLabel,
  damageRatioLabel,
  formatDate,
  isDamageLevel,
  statusLabel,
  structureLabel,
  surveyTypeLabel,
} from 'features/survey/model/display';
import { expect, test } from 'vitest';

test('enum labels map to Japanese display names', () => {
  expect(surveyTypeLabel('first')).toBe('第1次調査');
  expect(surveyTypeLabel('second')).toBe('第2次調査');
  expect(statusLabel('confirmed')).toBe('確定');
  expect(structureLabel('wood')).toBe('木造');
  expect(structureLabel('nonWood')).toBe('非木造');
});

test('isDamageLevel narrows known keys', () => {
  expect(isDamageLevel('totalCollapse')).toBe(true);
  expect(isDamageLevel('nope')).toBe(false);
});

test('damageLevelLabel: null=未計算, known=display, unknown=passthrough', () => {
  expect(damageLevelLabel(null)).toBe('未計算');
  expect(damageLevelLabel('totalCollapse')).toBe('全壊');
  expect(damageLevelLabel('weird-value')).toBe('weird-value');
});

test('damageRatioLabel and formatDate', () => {
  expect(damageRatioLabel(null)).toBe('未計算');
  expect(damageRatioLabel(42)).toBe('42%');
  expect(formatDate(Date.UTC(2026, 5, 16))).toBe('2026-06-16');
});
