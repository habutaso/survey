import {
  DAMAGE_LEVEL_DISPLAY,
  STRUCTURE_TYPE_DISPLAY,
  SURVEY_STATUS_DISPLAY,
  SURVEY_TYPE_DISPLAY,
} from 'common/constants';
import type { SurveyDto } from 'common/types/survey';

export const surveyTypeLabel = (surveyType: SurveyDto['surveyType']): string =>
  SURVEY_TYPE_DISPLAY[surveyType];

export const statusLabel = (status: SurveyDto['status']): string => SURVEY_STATUS_DISPLAY[status];

export const structureLabel = (structureType: SurveyDto['structureType']): string =>
  STRUCTURE_TYPE_DISPLAY[structureType];

export const isDamageLevel = (value: string): value is keyof typeof DAMAGE_LEVEL_DISPLAY =>
  value in DAMAGE_LEVEL_DISPLAY;

// damageLevel は DTO 上 string|null（サーバ再計算前は null）。既知区分は日本語表示名、未計算は明示。
export const damageLevelLabel = (level: string | null): string => {
  if (level === null) return '未計算';
  return isDamageLevel(level) ? DAMAGE_LEVEL_DISPLAY[level] : level;
};

export const damageRatioLabel = (ratio: number | null): string =>
  ratio === null ? '未計算' : `${ratio}%`;

export const formatDate = (epochMs: number): string =>
  new Date(epochMs).toISOString().slice(0, 10);
