import type { SurveyCsvRow } from 'common/types/export';

// CSV ヘッダ・列順（SurveyCsvRow と整合, U5 / Q-U5-2=A）。
const CSV_HEADER: { key: keyof SurveyCsvRow; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'surveyType', label: '調査区分' },
  { key: 'status', label: '状態' },
  { key: 'address', label: '所在地' },
  { key: 'houseNumber', label: '家屋番号' },
  { key: 'structureType', label: '構造種別' },
  { key: 'buildingName', label: '建物名称' },
  { key: 'floors', label: '階数' },
  { key: 'victimName', label: '被災者氏名' },
  { key: 'victimContact', label: '被災者連絡先' },
  { key: 'victimAddress', label: '被災者住所' },
  { key: 'damageRatio', label: '損害割合' },
  { key: 'damageLevel', label: '被害度区分' },
  { key: 'createdBy', label: '実施者' },
  { key: 'createdTime', label: '作成日時' },
  { key: 'submittedAt', label: '提出日時' },
  { key: 'approvedAt', label: '承認日時' },
  { key: 'confirmedAt', label: '確定日時' },
];

const BOM = '\uFEFF';

// RFC4180 エスケープ（カンマ・改行・ダブルクォートを含む場合は "" で囲み " を二重化）。
const escapeField = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const toLine = (fields: string[]): string => fields.map(escapeField).join(',');

export const csvRenderer = {
  // CSV 生成（U5 / BR-U5-12）。UTF-8 BOM＋ヘッダ＋行。0 件はヘッダのみ。改行は CRLF。
  render: (rows: SurveyCsvRow[]): Buffer => {
    const header = toLine(CSV_HEADER.map((c) => c.label));
    const body = rows.map((row) => toLine(CSV_HEADER.map((c) => row[c.key])));

    return Buffer.from(`${BOM}${[header, ...body].join('\r\n')}\r\n`, 'utf-8');
  },
};
