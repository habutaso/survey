import type { SurveyCsvRow } from 'common/types/export';
import { csvRenderer } from 'domain/export/model/csvRenderer';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

const BOM = '\uFEFF';

const row = (over: Partial<SurveyCsvRow> = {}): SurveyCsvRow => ({
  id: 'id1',
  surveyType: '第1次調査',
  status: '提出',
  address: 'addr',
  houseNumber: '1',
  structureType: '木造',
  buildingName: '',
  floors: '',
  victimName: '',
  victimContact: '',
  victimAddress: '',
  damageRatio: '10',
  damageLevel: '半壊',
  createdBy: 'u1',
  createdTime: '',
  submittedAt: '',
  approvedAt: '',
  confirmedAt: '',
  ...over,
});

// RFC4180 単純パーサ（テスト検証用）。引用フィールド内の "" は "、カンマ・改行・引用を解釈。
// パーサの性質上、分岐数・ネストが規定値を超えるため本関数に限り無効化する。
/* eslint-disable complexity, max-depth */
const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      cur.push(field);
      field = '';
    } else if (c === '\r') {
      // skip; CRLF の \n で行確定
    } else if (c === '\n') {
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = '';
    } else field += c;
  }

  if (field !== '' || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }

  return rows;
};
/* eslint-enable complexity, max-depth */

describe('csvRenderer.render（U5 / BR-U5-12 / Q-U5-2=A）', () => {
  test('先頭に UTF-8 BOM、1 行目はヘッダラベル', () => {
    const text = csvRenderer.render([]).toString('utf-8');

    expect(text.startsWith(BOM)).toBe(true);

    const [header] = parseCsv(text.slice(BOM.length));

    expect(header?.[0]).toBe('ID');
    expect(header?.[1]).toBe('調査区分');
  });

  test('0 件はヘッダのみ（データ行なし）', () => {
    const text = csvRenderer.render([]).toString('utf-8').slice(BOM.length);

    expect(parseCsv(text).length).toBe(1);
  });

  test('カンマ・改行・ダブルクォートを含む値をエスケープ', () => {
    const text = csvRenderer
      .render([row({ address: 'a,b\n"c"' })])
      .toString('utf-8')
      .slice(BOM.length);
    const parsed = parseCsv(text);

    // address は 4 列目（index 3）。
    expect(parsed[1]?.[3]).toBe('a,b\n"c"');
  });

  test('PBT: 任意文字列の address がエスケープ→パースで復元（可逆性）', () => {
    fc.assert(
      fc.property(fc.fullUnicodeString(), (value) => {
        const text = csvRenderer.render([row({ address: value })]).toString('utf-8').slice(BOM.length);

        expect(parseCsv(text)[1]?.[3]).toBe(value);
      }),
    );
  });
});
