import { STRUCTURE_TYPE_LIST, SURVEY_TYPE_LIST } from 'common/constants';
import { boundedString, numberInRange, percentage } from 'common/validators/common';
import { z } from 'zod';
import { brandedId } from './brandedId';

// 調査区分・構造種別のバリデータ（SECURITY-05 / 入力検証, BR-6 検証表）。
export const surveyTypeValidator = z.enum(SURVEY_TYPE_LIST);
export const structureTypeValidator = z.enum(STRUCTURE_TYPE_LIST);

// 階按分（FR-28）。合計=100 の許容誤差（U3c で最終確定までの暫定値）。
const FLOOR_RATIO_SUM = 100;
const FLOOR_RATIO_EPSILON = 0.01;

const floorRatio = z.object({ floor: z.number().int().min(1), ratio: percentage });

const partDamage = z.object({ part: boundedString().min(1), damageRatio: percentage });

const externalForceFlags = z.object({
  houseWashedAway: z.boolean(),
  groundScour: z.boolean(),
  foundationWashout: z.boolean(),
  fullCeilingInundation: z.boolean(),
});

const submissionObject = z.object({
  survey: z.object({
    id: brandedId.survey.dto,
    surveyType: surveyTypeValidator,
    parentSurveyId: brandedId.survey.dto.optional(),
    address: boundedString().min(1),
    houseNumber: boundedString().min(1),
    structureType: structureTypeValidator,
    buildingName: boundedString().optional(),
    floors: z.number().int().min(1).optional(),
    victimName: boundedString().optional(),
    victimContact: boundedString().optional(),
    victimAddress: boundedString().optional(),
    latitude: numberInRange(-90, 90).optional(),
    longitude: numberInRange(-180, 180).optional(),
  }),
  firstSurvey: z
    .object({
      externalForceFlags,
      tiltRatio: z.number().min(0).optional(),
      inundationDepthCm: z.number().min(0).optional(),
      floorApportionment: z.array(floorRatio).optional(),
    })
    .optional(),
  secondSurvey: z
    .object({
      partDamages: z.array(partDamage),
      floorApportionment: z.array(floorRatio).optional(),
    })
    .optional(),
  photos: z
    .array(z.object({ fileName: boundedString().min(1), contentType: boundedString().min(1) }))
    .optional(),
});

type SubmissionInput = z.infer<typeof submissionObject>;

const issue = (ctx: z.RefinementCtx, message: string, path: (string | number)[]): void =>
  ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });

// 第1次: 第1次入力必須・第2次入力不可・親 ID 不可（BR-3/4/21）。
const refineFirstType = (val: SubmissionInput, ctx: z.RefinementCtx): void => {
  if (val.firstSurvey === undefined) issue(ctx, '第1次調査には第1次入力が必要です', ['firstSurvey']);
  if (val.secondSurvey !== undefined) {
    issue(ctx, '第1次調査に第2次入力を含めることはできません', ['secondSurvey']);
  }
  if (val.survey.parentSurveyId !== undefined) {
    issue(ctx, '第1次調査に親調査IDは指定できません', ['survey', 'parentSurveyId']);
  }
};

// 第2次: 第2次入力必須・第1次入力不可・親 ID 必須（BR-3/4/5/21）。
const refineSecondType = (val: SubmissionInput, ctx: z.RefinementCtx): void => {
  if (val.secondSurvey === undefined) {
    issue(ctx, '第2次調査には第2次入力が必要です', ['secondSurvey']);
  }
  if (val.firstSurvey !== undefined) {
    issue(ctx, '第2次調査に第1次入力を含めることはできません', ['firstSurvey']);
  }
  if (val.survey.parentSurveyId === undefined) {
    issue(ctx, '第2次調査には親調査IDが必要です', ['survey', 'parentSurveyId']);
  }
};

// 階按分合計=100 検証（BR-20）。指定時のみ（誤差許容）。
const refineFloorSum = (
  sub: { floorApportionment?: { floor: number; ratio: number }[] } | undefined,
  ctx: z.RefinementCtx,
  path: string,
): void => {
  const floors = sub?.floorApportionment;

  if (floors === undefined || floors.length === 0) return;

  const sum = floors.reduce((acc, f) => acc + f.ratio, 0);

  if (Math.abs(sum - FLOOR_RATIO_SUM) > FLOOR_RATIO_EPSILON) {
    issue(ctx, '階按分の合計は 100 でなければなりません', [path, 'floorApportionment']);
  }
};

export const surveyValidator = {
  // 提出時一括同期ペイロード（US-207）。区分排他・親 ID は superRefine（BR-3/21）。
  submissionBody: submissionObject.superRefine((val, ctx) => {
    if (val.survey.surveyType === 'first') refineFirstType(val, ctx);
    else refineSecondType(val, ctx);

    refineFloorSum(val.firstSurvey, ctx, 'firstSurvey');
    refineFloorSum(val.secondSurvey, ctx, 'secondSurvey');
  }),

  // 正式判定（US-606）。採用する Survey の ID。
  chooseOfficialBody: z.object({ officialSurveyId: brandedId.survey.dto }),
};