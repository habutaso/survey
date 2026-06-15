import type { DraftInput, LocalDraft, LocalSurveyType } from 'features/localFirst';

// ウィザードのステップキー（US-205）。
export type StepKey =
  | 'house'
  | 'victim'
  | 'firstInput'
  | 'secondInput'
  | 'photos'
  | 'floors'
  | 'review';

const FLOOR_SUM = 100;
const FLOOR_EPSILON = 0.01;

// 複数階建て判定（単層は floors ステップをスキップ, US-404 / BR-U6u-1）。
export const isMultiStory = (floors: number | null | undefined): boolean => (floors ?? 1) > 1;

// surveyType と floors からステップ列を導出（INV-U6u-1/2）。
export const stepsFor = (
  surveyType: LocalSurveyType,
  floors: number | null | undefined,
): StepKey[] => {
  const typeStep: StepKey = surveyType === 'first' ? 'firstInput' : 'secondInput';
  const base: StepKey[] = ['house', 'victim', typeStep, 'photos'];
  const withFloors: StepKey[] = isMultiStory(floors) ? [...base, 'floors'] : base;
  return [...withFloors, 'review'];
};

const floorApportionmentOf = (input: DraftInput): { floor: number; ratio: number }[] =>
  input.firstSurvey?.floorApportionment ?? input.secondSurvey?.floorApportionment ?? [];

const floorsComplete = (input: DraftInput): boolean => {
  const apportionment = floorApportionmentOf(input);
  if (apportionment.length === 0) return false;
  const sum = apportionment.reduce((acc, floor) => acc + floor.ratio, 0);
  return Math.abs(sum - FLOOR_SUM) <= FLOOR_EPSILON;
};

const STEP_COMPLETE: Record<StepKey, (draft: LocalDraft) => boolean> = {
  house: (d) =>
    d.input.survey.address !== undefined &&
    d.input.survey.houseNumber !== undefined &&
    d.input.survey.structureType !== undefined,
  victim: () => true,
  firstInput: (d) => d.input.firstSurvey?.externalForceFlags !== undefined,
  secondInput: (d) => (d.input.secondSurvey?.partDamages?.length ?? 0) > 0,
  photos: () => true,
  floors: (d) => floorsComplete(d.input),
  review: () => false,
};

export const isStepComplete = (step: StepKey, draft: LocalDraft): boolean =>
  STEP_COMPLETE[step](draft);

export const completedSteps = (steps: StepKey[], draft: LocalDraft): StepKey[] =>
  steps.filter((step) => isStepComplete(step, draft));

export const firstIncomplete = (steps: StepKey[], draft: LocalDraft): StepKey =>
  steps.find((step) => !isStepComplete(step, draft)) ?? 'review';

// 移動可否（US-206 / INV-U6u-3）: 完了済み or 最初の未完了ステップのみ。
export const canNavigate = (steps: StepKey[], draft: LocalDraft, target: StepKey): boolean => {
  if (steps.indexOf(target) < 0) return false;
  if (isStepComplete(target, draft)) return true;
  return target === firstIncomplete(steps, draft);
};

export const nextStep = (steps: StepKey[], current: StepKey): StepKey => {
  const idx = steps.indexOf(current);
  return steps[Math.min(idx + 1, steps.length - 1)] ?? current;
};

export const prevStep = (steps: StepKey[], current: StepKey): StepKey => {
  const idx = steps.indexOf(current);
  return steps[Math.max(idx - 1, 0)] ?? current;
};
