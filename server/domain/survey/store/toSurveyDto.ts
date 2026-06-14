import type { FirstSurvey, SecondSurvey, Survey } from '@prisma/client';
import type {
  ExternalForceFlags,
  FirstSurveyData,
  FloorRatio,
  Json,
  PartDamage,
  SecondSurveyData,
  StructureType,
  SurveyCommon,
  SurveyDetailDto,
  SurveyDto,
  SurveyStatus,
  SurveyType,
} from 'common/types/survey';
import { brandedId } from 'common/validators/brandedId';

// 第1次/第2次の従属データを含む取得行（include: { first, second }）。
export type SurveyRow = Survey & { first: FirstSurvey | null; second: SecondSurvey | null };

// 共通変換ヘルパー（分岐集約でカバレッジを単純化）。
const ms = (date: Date | null): number | null => (date === null ? null : date.getTime());
const userDtoId = (id: string | null): SurveyCommon['officialChosenBy'] =>
  id === null ? null : brandedId.user.dto.parse(id);
const surveyDtoId = (id: string | null): SurveyCommon['parentSurveyId'] =>
  id === null ? null : brandedId.survey.dto.parse(id);

const toFirstData = (first: FirstSurvey | null): FirstSurveyData | null =>
  first === null
    ? null
    : {
        externalForceFlags: first.externalForceFlags as unknown as ExternalForceFlags,
        tiltRatio: first.tiltRatio,
        inundationDepthCm: first.inundationDepthCm,
        floorApportionment: first.floorApportionment as unknown as FloorRatio[] | null,
      };

const toSecondData = (second: SecondSurvey | null): SecondSurveyData | null =>
  second === null
    ? null
    : {
        partDamages: second.partDamages as unknown as PartDamage[],
        floorApportionment: second.floorApportionment as unknown as FloorRatio[] | null,
      };

// 非 PII 共通フィールドの変換。
const toCommon = (row: SurveyRow): SurveyCommon => ({
  surveyType: row.surveyType as SurveyType,
  parentSurveyId: surveyDtoId(row.parentSurveyId),
  status: row.status as SurveyStatus,
  address: row.address,
  houseNumber: row.houseNumber,
  structureType: row.structureType as StructureType,
  buildingName: row.buildingName,
  floors: row.floors,
  latitude: row.latitude,
  longitude: row.longitude,
  damageRatio: row.damageRatio,
  damageLevel: row.damageLevel,
  assessmentBasis: row.assessmentBasis as unknown as Json | null,
  officialSurveyId: surveyDtoId(row.officialSurveyId),
  officialChosenBy: userDtoId(row.officialChosenBy),
  officialChosenAt: ms(row.officialChosenAt),
  createdBy: brandedId.user.dto.parse(row.createdBy),
  createdTime: row.createdAt.getTime(),
  submittedAt: ms(row.submittedAt),
  approvedBy: userDtoId(row.approvedBy),
  approvedAt: ms(row.approvedAt),
  confirmedBy: userDtoId(row.confirmedBy),
  confirmedAt: ms(row.confirmedAt),
  first: toFirstData(row.first),
  second: toSecondData(row.second),
});

// 一覧・低権限用 DTO（PII 除外, BR-13 / INV-5）。
export const toSurveyDto = (row: SurveyRow): SurveyDto => ({
  ...toCommon(row),
  id: brandedId.survey.dto.parse(row.id),
});

// 詳細用 DTO（PII 含む, 調査員/管理者のみ）。
export const toSurveyDetailDto = (row: SurveyRow): SurveyDetailDto => ({
  ...toCommon(row),
  id: brandedId.survey.dto.parse(row.id),
  victimName: row.victimName,
  victimContact: row.victimContact,
  victimAddress: row.victimAddress,
});