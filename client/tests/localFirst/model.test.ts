import type { DtoId } from 'common/types/brandedId';
import type { ExternalForceFlags, PartDamage } from 'common/types/survey';
import { expect, test } from 'vitest';
import {
  addPhotoId,
  applyUpdate,
  createDraft,
  removePhotoId,
  withSyncState,
} from 'features/localFirst/model/localDraft';
import {
  createLocalPhoto,
  isImageType,
  markUploaded,
  toPhotoMeta,
  withStatus,
} from 'features/localFirst/model/localPhoto';
import { baseDelayMs, nextDelayMs, shouldRetry, MAX_ATTEMPTS } from 'features/localFirst/model/backoff';
import {
  createJob,
  isDue,
  isExhausted,
  recordFailure,
  resetForRetry,
  withConfirmed,
  withStage,
  withTickets,
} from 'features/localFirst/model/syncJob';
import {
  IncompleteDraftError,
  toSubmissionPayload,
} from 'features/localFirst/model/toPayload';
import type { LocalDraft } from 'features/localFirst/types';

const sid = (s: string): DtoId['survey'] => s as DtoId['survey'];
const pid = (s: string): DtoId['photo'] => s as DtoId['photo'];
const flags: ExternalForceFlags = {
  houseWashedAway: false,
  groundScour: false,
  foundationWashout: false,
  fullCeilingInundation: false,
};
const parts: PartDamage[] = [{ part: 'roof', damageRatio: 10 }];

// --- localDraft ---
test('createDraft initializes editing draft, with/without parentSurveyId', () => {
  const a = createDraft({ id: 'a', surveyType: 'first', now: 1 });
  expect(a.syncState).toBe('editing');
  expect(a.input.survey).toStrictEqual({});
  const b = createDraft({ id: 'b', surveyType: 'second', now: 1, parentSurveyId: sid('p') });
  expect(b.input.survey.parentSurveyId).toBe('p');
});

test('applyUpdate merges survey/first/second and progress', () => {
  const base = createDraft({ id: 'a', surveyType: 'first', now: 1 });
  const withSurvey = applyUpdate(
    base,
    { input: { survey: { address: 'x' } }, progress: { currentStep: 's2', completedSteps: ['s1'], updatedAt: 2 } },
    2,
  );
  expect(withSurvey.input.survey.address).toBe('x');
  expect(withSurvey.progress.currentStep).toBe('s2');

  const withTypes = applyUpdate(
    withSurvey,
    { input: { firstSurvey: { tiltRatio: 3 }, secondSurvey: { partDamages: parts } } },
    3,
  );
  expect(withTypes.input.firstSurvey?.tiltRatio).toBe(3);
  expect(withTypes.input.secondSurvey?.partDamages).toStrictEqual(parts);
  expect(withTypes.progress.currentStep).toBe('s2'); // progress untouched

  const onlyProgress = applyUpdate(withTypes, { progress: { currentStep: 's3', completedSteps: [], updatedAt: 4 } }, 4);
  expect(onlyProgress.input.survey.address).toBe('x'); // input untouched
});

test('withSyncState / addPhotoId / removePhotoId', () => {
  const base = createDraft({ id: 'a', surveyType: 'first', now: 1 });
  expect(withSyncState(base, 'failed', 'network', 5).syncState).toBe('failed');
  const added = addPhotoId(base, 'p1', 2);
  expect(added.photoIds).toStrictEqual(['p1']);
  expect(removePhotoId(added, 'p1', 3).photoIds).toStrictEqual([]);
});

// --- localPhoto ---
test('isImageType accepts image/* only', () => {
  expect(isImageType('image/jpeg')).toBe(true);
  expect(isImageType('application/pdf')).toBe(false);
});

test('createLocalPhoto / toPhotoMeta / withStatus / markUploaded', () => {
  const blob = new Blob(['x'], { type: 'image/png' });
  const photo = createLocalPhoto({
    id: 'ph',
    draftId: 'a',
    fileName: 'f.png',
    contentType: 'image/png',
    blob,
    part: 'roof',
    step: null,
    now: 1,
  });
  expect(photo.status).toBe('local');
  expect(photo.serverPhotoId).toBeNull();
  expect(toPhotoMeta(photo)).toStrictEqual({ fileName: 'f.png', contentType: 'image/png', part: 'roof', step: null });
  expect(withStatus(photo, 'uploading').status).toBe('uploading');
  const up = markUploaded(photo, pid('sp'));
  expect(up.status).toBe('uploaded');
  expect(up.serverPhotoId).toBe('sp');
});

// --- backoff ---
test('nextDelayMs is deterministic with injected rng and respects cap', () => {
  expect(nextDelayMs(0, () => 0.5)).toBe(1000); // jitterFactor=1
  expect(nextDelayMs(2, () => 0.5)).toBe(4000);
  expect(nextDelayMs(100, () => 0.5)).toBe(30000); // cap
});

test('nextDelayMs default rng stays within jitter band', () => {
  const d = nextDelayMs(0); // exercises default Math.random
  expect(d).toBeGreaterThanOrEqual(800);
  expect(d).toBeLessThanOrEqual(1200);
});

test('INV-U6f-6: baseDelayMs monotonic up to cap; shouldRetry honors MAX_ATTEMPTS', () => {
  expect(baseDelayMs(0)).toBeLessThan(baseDelayMs(1));
  expect(baseDelayMs(1)).toBeLessThan(baseDelayMs(2));
  expect(baseDelayMs(100)).toBe(30000);
  expect(shouldRetry(0)).toBe(true);
  expect(shouldRetry(MAX_ATTEMPTS)).toBe(false);
});

// --- syncJob ---
test('createJob and stage/ticket/confirmed transitions', () => {
  const job = createJob({ id: 'j', draftId: 'a', surveyId: sid('a'), now: 10 });
  expect(job.stage).toBe('submission');
  expect(withStage(job, 'confirm', 11).stage).toBe('confirm');
  expect(withTickets(job, [{ photoId: pid('p'), putUrl: 'u' }], 11).uploadTickets).toHaveLength(1);
  expect(withConfirmed(job, [pid('p')], 11).confirmedPhotoIds).toStrictEqual(['p']);
});

test('recordFailure increments attempts and backs off (injected + default rng)', () => {
  const job = createJob({ id: 'j', draftId: 'a', surveyId: sid('a'), now: 0 });
  const f1 = recordFailure(job, 'network', 0, () => 0.5);
  expect(f1.attempts).toBe(1);
  expect(f1.nextAttemptAt).toBe(2000);
  expect(f1.lastError).toBe('network');
  expect(recordFailure(job, 'server', 0).attempts).toBe(1); // default rng path
});

test('resetForRetry, isExhausted, isDue', () => {
  const job = createJob({ id: 'j', draftId: 'a', surveyId: sid('a'), now: 0 });
  const reset = resetForRetry({ ...job, attempts: 5, nextAttemptAt: 999 }, 50);
  expect(reset.attempts).toBe(0);
  expect(reset.nextAttemptAt).toBe(50);
  expect(isExhausted({ ...job, attempts: MAX_ATTEMPTS })).toBe(true);
  expect(isExhausted({ ...job, attempts: 1 })).toBe(false);
  expect(isDue({ ...job, nextAttemptAt: 10 }, 20)).toBe(true);
  expect(isDue({ ...job, nextAttemptAt: 30 }, 20)).toBe(false); // future
  expect(isDue({ ...job, stage: 'done', nextAttemptAt: 0 }, 20)).toBe(false); // done
});

// --- toPayload ---
const baseFirst = (): LocalDraft => ({
  id: 's1',
  surveyType: 'first',
  input: { survey: { address: 'a', houseNumber: '1', structureType: 'wood' }, firstSurvey: { externalForceFlags: flags } },
  progress: { currentStep: '', completedSteps: [], updatedAt: 0 },
  photoIds: [],
  syncState: 'editing',
  lastError: null,
  createdAt: 0,
  updatedAt: 0,
});

test('toSubmissionPayload builds a first-survey payload with photos', () => {
  const payload = toSubmissionPayload(baseFirst(), [{ fileName: 'f', contentType: 'image/png', part: null, step: null }]);
  expect(payload.survey.surveyType).toBe('first');
  expect(payload.firstSurvey?.externalForceFlags).toStrictEqual(flags);
  expect(payload.secondSurvey).toBeUndefined();
  expect(payload.photos).toHaveLength(1);
});

test('toSubmissionPayload builds a second-survey payload', () => {
  const draft: LocalDraft = {
    ...baseFirst(),
    surveyType: 'second',
    input: {
      survey: { address: 'a', houseNumber: '1', structureType: 'wood', parentSurveyId: sid('p') },
      secondSurvey: { partDamages: parts },
    },
  };
  const payload = toSubmissionPayload(draft, []);
  expect(payload.secondSurvey?.partDamages).toStrictEqual(parts);
  expect(payload.survey.parentSurveyId).toBe('p');
});

test('toSubmissionPayload throws IncompleteDraftError for each missing required field', () => {
  const missing = (mutate: (d: LocalDraft) => LocalDraft): unknown => {
    try {
      toSubmissionPayload(mutate(baseFirst()), []);
      return 'no-throw';
    } catch (e) {
      return e;
    }
  };
  expect(missing((d) => ({ ...d, input: { ...d.input, survey: { houseNumber: '1', structureType: 'wood' } } }))).toBeInstanceOf(IncompleteDraftError);
  expect(missing((d) => ({ ...d, input: { ...d.input, survey: { address: 'a', structureType: 'wood' } } }))).toBeInstanceOf(IncompleteDraftError);
  expect(missing((d) => ({ ...d, input: { ...d.input, survey: { address: 'a', houseNumber: '1' } } }))).toBeInstanceOf(IncompleteDraftError);
  expect(missing((d) => ({ ...d, input: { survey: d.input.survey } }))).toBeInstanceOf(IncompleteDraftError); // first missing flags
});

test('toSubmissionPayload requires parentSurveyId and partDamages for second survey', () => {
  const noParent: LocalDraft = {
    ...baseFirst(),
    surveyType: 'second',
    input: { survey: { address: 'a', houseNumber: '1', structureType: 'wood' }, secondSurvey: { partDamages: parts } },
  };
  expect(() => toSubmissionPayload(noParent, [])).toThrow(IncompleteDraftError);
  const noParts: LocalDraft = {
    ...baseFirst(),
    surveyType: 'second',
    input: { survey: { address: 'a', houseNumber: '1', structureType: 'wood', parentSurveyId: sid('p') } },
  };
  expect(() => toSubmissionPayload(noParts, [])).toThrow(IncompleteDraftError);
});
