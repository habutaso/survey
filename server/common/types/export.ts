import type { SurveyDetailDto } from './survey';

// エクスポート形式（U5 / Q-U5-2=A: CSV、Q-U5-1=A: PDF）。
export type ExportFormat = 'pdf' | 'csv';

// 生成物の受け渡し（Q-U5-8=B）。S3 に保存し presigned GET URL を返す。
export type ExportTicket = {
  format: ExportFormat;
  url: string; // presigned GET（短命）
  filename: string; // ダウンロード時の表示名
  expiresInSec: number; // URL 有効期限（秒）
};

// PDF データモデル（家屋単位, Q-U5-10=B）。整形済みビュー（純粋変換の出力）。
// first=第1次（PII 含む, admin のみ）、seconds=紐づく第2次群（時系列）。
export type SurveyPdfModel = {
  first: SurveyDetailDto;
  seconds: SurveyDetailDto[];
};

// CSV 行（複数件, PII 含む, admin のみ, Q-U5-7=A）。列順は csvRenderer のヘッダで固定。
// 値はすべて整形済み文字列（enum→表示名、epoch→ISO、null→空文字）。
export type SurveyCsvRow = {
  id: string;
  surveyType: string;
  status: string;
  address: string;
  houseNumber: string;
  structureType: string;
  buildingName: string;
  floors: string;
  victimName: string; // PII
  victimContact: string; // PII
  victimAddress: string; // PII
  damageRatio: string;
  damageLevel: string;
  createdBy: string;
  createdTime: string;
  submittedAt: string;
  approvedAt: string;
  confirmedAt: string;
};
