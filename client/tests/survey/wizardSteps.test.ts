import fc from 'fast-check';
import type { DraftInput, LocalDraft, LocalSurveyType } from 'features/localFirst';
import {
  canNavigate,
  completedSteps,
  firstIncomplete,
  isMultiStory,
  isStepComplete,
  nextStep,
  prevStep,
  stepsFor,
  type StepKey,
} from 'features/survey/model/wizardSteps';
import { expect, test } from 'vitest';

const draftOf = (surveyType: LocalSurveyType, input: DraftInput): LocalDraft => ({
  id: 'd',
  surveyType,
  input,
  progress: { currentStep: '', completedSteps: [], updatedAt: 0 },
  photoIds: [],
  syncState: 'editing',
  lastError: null,
  createdAt: 0,
  updatedAt: 0,
});

const emptyInput: DraftInput = { survey: {} };

test('isMultiStory: >1 true, <=1 and nullish false', () => {
  expect(isMultiStory(2)).toBe(true);
  expect(isMultiStory(1)).toBe(false);
  expect(isMultiStory(0)).toBe(false);
  expect(isMultiStory(null)).toBe(false);
  expect(isMultiStory(undefined)).toBe(false);
});

test('INV-U6u-1/2: stepsFor starts at house, ends at review, floors only when multi-story', () => {
  expect(stepsFor('first', 1)).toStrictEqual(['house', 'victim', 'firstInput', 'photos', 'review']);
  expect(stepsFor('first', 2)).toStrictEqual([
    'house',
    'victim',
    'firstInput',
    'photos',
    'floors',
    'review',
  ]);
  expect(stepsFor('second', 3)).toStrictEqual([
    'house',
    'victim',
    'secondInput',
    'photos',
    'floors',
    'review',
  ]);
});

test('INV-U6u-1/2 (PBT): house first, review last, floors iff multi-story', () => {
  const surveyType = fc.constantFrom<LocalSurveyType>('first', 'second');
  fc.assert(
    fc.property(surveyType, fc.option(fc.integer({ min: 0, max: 5 }), { nil: undefined }), (t, f) => {
      const steps = stepsFor(t, f);
      expect(steps[0]).toBe('house');
      expect(steps[steps.length - 1]).toBe('review');
      expect(steps.includes('floors')).toBe(isMultiStory(f));
      expect(steps.includes('firstInput')).toBe(t === 'first');
    }),
  );
});

test('isStepComplete covers all step predicates', () => {
  const full: DraftInput = {
    survey: { address: 'a', houseNumber: '1', structureType: 'wood' },
    firstSurvey: { externalForceFlags: { houseWashedAway: false, groundScour: false, foundationWashout: false, fullCeilingInundation: false } },
    secondSurvey: { partDamages: [{ part: 'roof', damageRatio: 10 }] },
  };
  const d = draftOf('first', full);
  expect(isStepComplete('house', d)).toBe(true);
  expect(isStepComplete('victim', d)).toBe(true);
  expect(isStepComplete('firstInput', d)).toBe(true);
  expect(isStepComplete('secondInput', d)).toBe(true);
  expect(isStepComplete('photos', d)).toBe(true);
  expect(isStepComplete('review', d)).toBe(false);

  const empty = draftOf('first', emptyInput);
  expect(isStepComplete('house', empty)).toBe(false);
  expect(isStepComplete('firstInput', empty)).toBe(false);
  expect(isStepComplete('secondInput', empty)).toBe(false);
});

test('floors completion: undefined/empty/wrong-sum false, sum==100 true (both first/second)', () => {
  expect(isStepComplete('floors', draftOf('first', emptyInput))).toBe(false);
  expect(
    isStepComplete('floors', draftOf('first', { survey: {}, firstSurvey: { floorApportionment: [] } })),
  ).toBe(false);
  expect(
    isStepComplete('floors', draftOf('first', { survey: {}, firstSurvey: { floorApportionment: [{ floor: 1, ratio: 60 }] } })),
  ).toBe(false);
  expect(
    isStepComplete(
      'floors',
      draftOf('first', { survey: {}, firstSurvey: { floorApportionment: [{ floor: 1, ratio: 60 }, { floor: 2, ratio: 40 }] } }),
    ),
  ).toBe(true);
  expect(
    isStepComplete(
      'floors',
      draftOf('second', { survey: {}, secondSurvey: { partDamages: [], floorApportionment: [{ floor: 1, ratio: 100 }] } }),
    ),
  ).toBe(true);
});

test('completedSteps is a subset; firstIncomplete finds the first gap or review', () => {
  const steps = stepsFor('first', 1);
  const partial = draftOf('first', { survey: { address: 'a', houseNumber: '1', structureType: 'wood' } });
  const done = completedSteps(steps, partial);
  expect(done.every((s) => steps.includes(s))).toBe(true); // INV-U6u-4
  expect(firstIncomplete(steps, partial)).toBe('firstInput');

  const allComplete = draftOf('first', {
    survey: { address: 'a', houseNumber: '1', structureType: 'wood' },
    firstSurvey: { externalForceFlags: { houseWashedAway: false, groundScour: false, foundationWashout: false, fullCeilingInundation: false } },
  });
  expect(firstIncomplete(stepsFor('first', 1), allComplete)).toBe('review');
});

test('INV-U6u-3: canNavigate allows completed and first-incomplete only', () => {
  const steps = stepsFor('first', 1);
  const partial = draftOf('first', { survey: { address: 'a', houseNumber: '1', structureType: 'wood' } });
  expect(canNavigate(steps, partial, 'house')).toBe(true); // completed
  expect(canNavigate(steps, partial, 'firstInput')).toBe(true); // first incomplete
  expect(canNavigate(steps, partial, 'review')).toBe(false); // later incomplete
  expect(canNavigate(steps, partial, 'floors' as StepKey)).toBe(false); // not in steps
});

test('nextStep/prevStep clamp at boundaries', () => {
  const steps = stepsFor('first', 1);
  expect(nextStep(steps, 'house')).toBe('victim');
  expect(nextStep(steps, 'review')).toBe('review'); // clamp end
  expect(prevStep(steps, 'victim')).toBe('house');
  expect(prevStep(steps, 'house')).toBe('house'); // clamp start
});

test('navigation helpers handle empty input defensively', () => {
  const empty: StepKey[] = [];
  const d = draftOf('first', emptyInput);
  expect(firstIncomplete(empty, d)).toBe('review');
  expect(nextStep(empty, 'house')).toBe('house');
  expect(prevStep(empty, 'house')).toBe('house');
});
