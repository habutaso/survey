import { exportFormat } from 'domain/export/model/exportFormat';
import { describe, expect, test } from 'vitest';
import { makeDetail } from './surveyFixtures';

describe('exportFormat.toCsvRows（U5 / Q-U5-7=A）', () => {
  test('enum→表示名・PII 列・epoch→ISO・null→空文字', () => {
    const detail = makeDetail('submitted', {
      damageRatio: 40,
      damageLevel: 'half',
      buildingName: null,
      floors: null,
      victimName: '被災 太郎',
      victimContact: '090',
      victimAddress: '住所',
      submittedAt: 0,
      approvedAt: null,
      confirmedAt: null,
    });

    const row = exportFormat.toCsvRows([detail])[0]!;

    expect(row.surveyType).toBe('第1次調査');
    expect(row.status).toBe('提出');
    expect(row.structureType).toBe('木造');
    expect(row.damageLevel).toBe('半壊');
    expect(row.damageRatio).toBe('40');
    expect(row.buildingName).toBe('');
    expect(row.floors).toBe('');
    expect(row.victimName).toBe('被災 太郎');
    expect(row.createdTime).toBe(new Date(0).toISOString());
    expect(row.submittedAt).toBe(new Date(0).toISOString());
    expect(row.approvedAt).toBe('');
    expect(row.confirmedAt).toBe('');
  });

  test('damageLevel が null なら空文字', () => {
    const row = exportFormat.toCsvRows([makeDetail('submitted', { damageLevel: null })])[0]!;

    expect(row.damageLevel).toBe('');
  });

  test('表示名マップに無い値はそのまま出力（fallback）', () => {
    const row = exportFormat.toCsvRows([makeDetail('submitted', { damageLevel: 'unknownLevel' })])[0]!;

    expect(row.damageLevel).toBe('unknownLevel');
  });

  test('空配列は空行', () => {
    expect(exportFormat.toCsvRows([])).toEqual([]);
  });
});

describe('exportFormat.toPdfModel（U5 / Q-U5-10=B）', () => {
  test('第1次＋第2次群を束ねる', () => {
    const first = makeDetail('confirmed', {}, 'first');
    const seconds = [makeDetail('submitted', {}, 'second')];
    const model = exportFormat.toPdfModel(first, seconds);

    expect(model.first).toBe(first);
    expect(model.seconds).toBe(seconds);
  });
});
