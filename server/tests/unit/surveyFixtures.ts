import type { FirstSurvey, SecondSurvey, Survey } from '@prisma/client';
import type { DtoId } from 'common/types/brandedId';
import type { Role } from 'common/types/role';
import type {
  ExternalForceFlags,
  SubmissionPayload,
  SurveyDetailDto,
  SurveyStatus,
  SurveyType,
} from 'common/types/survey';
import type { UserDto } from 'common/types/user';
import { brandedId } from 'common/validators/brandedId';
import type { SurveyRow } from 'domain/survey/store/toSurveyDto';

export const noForce: ExternalForceFlags = {
  houseWashedAway: false,
  groundScour: false,
  foundationWashout: false,
  fullCeilingInundation: false,
};

// survey DtoId へのブランド化ヘルパー（テスト用）。
export const sid = (s: string): DtoId['survey'] => brandedId.survey.dto.parse(s);

export const makeUser = (roles: Role[], id = 'user-1'): UserDto => ({
  id: brandedId.user.dto.parse(id),
  signInName: 'sign-in',
  displayName: 'display',
  email: 'u@example.com',
  createdTime: 0,
  photoUrl: undefined,
  roles,
});

export const firstPayload = (id: string): SubmissionPayload => ({
  survey: {
    id: brandedId.survey.dto.parse(id),
    surveyType: 'first',
    address: '東京都...',
    houseNumber: '1-1',
    structureType: 'wood',
    buildingName: 'B棟',
    floors: 2,
    victimName: '被災 太郎',
    victimContact: '090-0000-0000',
    victimAddress: '東京都被災',
    latitude: 35.6,
    longitude: 139.7,
  },
  firstSurvey: {
    externalForceFlags: noForce,
    tiltRatio: 0.1,
    inundationDepthCm: 50,
    floorApportionment: [
      { floor: 1, ratio: 60 },
      { floor: 2, ratio: 40 },
    ],
  },
  photos: [{ fileName: 'p.jpg', contentType: 'image/jpeg', part: null, step: null }],
});

export const minimalFirstPayload = (id: string): SubmissionPayload => ({
  survey: {
    id: brandedId.survey.dto.parse(id),
    surveyType: 'first',
    address: 'a',
    houseNumber: '1',
    structureType: 'nonWood',
  },
  firstSurvey: { externalForceFlags: noForce },
});

export const secondPayload = (id: string, parentId: string): SubmissionPayload => ({
  survey: {
    id: brandedId.survey.dto.parse(id),
    surveyType: 'second',
    parentSurveyId: brandedId.survey.dto.parse(parentId),
    address: '東京都...',
    houseNumber: '1-1',
    structureType: 'wood',
  },
  secondSurvey: {
    partDamages: [
      { part: 'roof', damageRatio: 30 },
      { part: 'wall', damageRatio: 20 },
    ],
    floorApportionment: [{ floor: 1, ratio: 100 }],
  },
});

export const makeDetail = (
  status: SurveyStatus,
  overrides: Partial<SurveyDetailDto> = {},
  surveyType: SurveyType = 'first',
): SurveyDetailDto => ({
  id: brandedId.survey.dto.parse('survey-1'),
  surveyType,
  parentSurveyId: null,
  status,
  address: 'a',
  houseNumber: '1',
  structureType: 'wood',
  buildingName: null,
  floors: null,
  latitude: null,
  longitude: null,
  damageRatio: null,
  damageLevel: null,
  assessmentBasis: null,
  officialSurveyId: null,
  officialChosenBy: null,
  officialChosenAt: null,
  createdBy: brandedId.user.dto.parse('user-1'),
  createdTime: 0,
  submittedAt: 0,
  approvedBy: null,
  approvedAt: null,
  confirmedBy: null,
  confirmedAt: null,
  first:
    surveyType === 'first'
      ? { externalForceFlags: noForce, tiltRatio: null, inundationDepthCm: null, floorApportionment: null }
      : null,
  second:
    surveyType === 'second'
      ? { partDamages: [{ part: 'roof', damageRatio: 10 }], floorApportionment: null }
      : null,
  victimName: null,
  victimContact: null,
  victimAddress: null,
  ...overrides,
});

// Prisma 行（include: first/second）。populated/null 両系を構築するための素材。
export const makeRow = (over: Partial<Survey> = {}, first: FirstSurvey | null = null, second: SecondSurvey | null = null): SurveyRow => ({
  id: 'survey-1',
  surveyType: 'first',
  parentSurveyId: null,
  status: 'submitted',
  address: 'a',
  houseNumber: '1',
  structureType: 'wood',
  buildingName: null,
  floors: null,
  victimName: null,
  victimContact: null,
  victimAddress: null,
  latitude: null,
  longitude: null,
  damageRatio: null,
  damageLevel: null,
  assessmentBasis: null,
  officialSurveyId: null,
  officialChosenBy: null,
  officialChosenAt: null,
  createdBy: 'user-1',
  createdAt: new Date(0),
  submittedAt: null,
  approvedBy: null,
  approvedAt: null,
  confirmedBy: null,
  confirmedAt: null,
  ...over,
  first,
  second,
});

export const makeFirstRow = (over: Record<string, unknown> = {}): FirstSurvey =>
  ({
    surveyId: 'survey-1',
    externalForceFlags: noForce,
    tiltRatio: null,
    inundationDepthCm: null,
    floorApportionment: null,
    ...over,
  }) as unknown as FirstSurvey;

export const makeSecondRow = (over: Record<string, unknown> = {}): SecondSurvey =>
  ({
    surveyId: 'survey-1',
    partDamages: [{ part: 'roof', damageRatio: 10 }],
    floorApportionment: null,
    ...over,
  }) as unknown as SecondSurvey;