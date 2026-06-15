import type { DtoId } from 'common/types/brandedId';
import type { PhotoMeta } from 'common/types/photo';
import type { SubmissionPayload } from 'common/types/survey';
import type { DraftInput, LocalDraft } from '../types';

// 提出に必要な入力が不足している下書きをペイロード化しようとしたときの例外。
export class IncompleteDraftError extends Error {
  constructor(field: string) {
    super(`missing required field: ${field}`);
    this.name = 'IncompleteDraftError';
  }
}

const required = <T>(value: T | undefined, field: string): T => {
  if (value === undefined) throw new IncompleteDraftError(field);
  return value;
};

const buildSurvey = (draft: LocalDraft): SubmissionPayload['survey'] => {
  const s = draft.input.survey;
  return {
    id: draft.id as DtoId['survey'],
    surveyType: draft.surveyType,
    parentSurveyId: s.parentSurveyId,
    address: required(s.address, 'address'),
    houseNumber: required(s.houseNumber, 'houseNumber'),
    structureType: required(s.structureType, 'structureType'),
    buildingName: s.buildingName,
    floors: s.floors,
    victimName: s.victimName,
    victimContact: s.victimContact,
    victimAddress: s.victimAddress,
    latitude: s.latitude,
    longitude: s.longitude,
  };
};

const buildFirst = (
  input: DraftInput['firstSurvey'],
): NonNullable<SubmissionPayload['firstSurvey']> => ({
  externalForceFlags: required(input?.externalForceFlags, 'externalForceFlags'),
  tiltRatio: input?.tiltRatio,
  inundationDepthCm: input?.inundationDepthCm,
  floorApportionment: input?.floorApportionment,
});

const buildSecond = (
  input: DraftInput['secondSurvey'],
): NonNullable<SubmissionPayload['secondSurvey']> => ({
  partDamages: required(input?.partDamages, 'partDamages'),
  floorApportionment: input?.floorApportionment,
});

// 下書き＋写真メタを U2 提出ペイロードへ整形する（区分排他, BR-U6f-11）。
// first → firstSurvey のみ / second → secondSurvey のみ＋parentSurveyId 必須。
export const toSubmissionPayload = (draft: LocalDraft, photos: PhotoMeta[]): SubmissionPayload => {
  const survey = buildSurvey(draft);
  if (draft.surveyType === 'first') {
    return { survey, firstSurvey: buildFirst(draft.input.firstSurvey), photos };
  }
  required(draft.input.survey.parentSurveyId, 'parentSurveyId');
  return { survey, secondSurvey: buildSecond(draft.input.secondSurvey), photos };
};
