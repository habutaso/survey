import {
  DAMAGE_LEVEL_DISPLAY,
  STRUCTURE_TYPE_DISPLAY,
  SURVEY_STATUS_DISPLAY,
  SURVEY_TYPE_DISPLAY,
} from 'common/constants';
import type { SurveyCsvRow, SurveyPdfModel } from 'common/types/export';
import type { SurveyDetailDto } from 'common/types/survey';

// 純粋整形ヘルパー（U5）。null→空文字、epoch→ISO、enum→表示名。
const str = (s: string | null): string => s ?? '';
const num = (n: number | null): string => (n === null ? '' : String(n));
const iso = (ms: number | null): string => (ms === null ? '' : new Date(ms).toISOString());
const disp = <T extends string>(map: Partial<Record<T, string>>, v: string | null): string =>
  v === null ? '' : (map[v as T] ?? v);

export const exportFormat = {
  // 家屋単位 PDF モデル（Q-U5-10=B）。第1次＋第2次群を束ねるのみ（純粋）。
  toPdfModel: (first: SurveyDetailDto, seconds: SurveyDetailDto[]): SurveyPdfModel => ({
    first,
    seconds,
  }),

  // 詳細 DTO 群 → CSV 行（PII 含む, Q-U5-7=A）。enum→表示名・null→空文字・epoch→ISO（純粋）。
  toCsvRows: (details: SurveyDetailDto[]): SurveyCsvRow[] =>
    details.map((d) => ({
      id: d.id,
      surveyType: disp(SURVEY_TYPE_DISPLAY, d.surveyType),
      status: disp(SURVEY_STATUS_DISPLAY, d.status),
      address: str(d.address),
      houseNumber: str(d.houseNumber),
      structureType: disp(STRUCTURE_TYPE_DISPLAY, d.structureType),
      buildingName: str(d.buildingName),
      floors: num(d.floors),
      victimName: str(d.victimName),
      victimContact: str(d.victimContact),
      victimAddress: str(d.victimAddress),
      damageRatio: num(d.damageRatio),
      damageLevel: disp(DAMAGE_LEVEL_DISPLAY, d.damageLevel),
      createdBy: str(d.createdBy),
      createdTime: iso(d.createdTime),
      submittedAt: iso(d.submittedAt),
      approvedAt: iso(d.approvedAt),
      confirmedAt: iso(d.confirmedAt),
    })),
};
