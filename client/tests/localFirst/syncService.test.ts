import type { DtoId } from 'common/types/brandedId';
import type { SubmissionPayload, SubmissionResultDto } from 'common/types/survey';
import type { ExternalForceFlags } from 'common/types/survey';
import type { PhotoUploadTicket } from 'common/types/photo';
import { expect, test } from 'vitest';
import type { SessionKeyProvider } from 'features/localFirst/crypto/sessionKeyProvider';
import { createLocalPhoto } from 'features/localFirst/model/localPhoto';
import { createJob } from 'features/localFirst/model/syncJob';
import { runSubmission, type SyncIo } from 'features/localFirst/service/stages';
import { createSyncService } from 'features/localFirst/service/syncService';
import { createLocalDraftStore } from 'features/localFirst/store/localDraftStore';
import type { LocalDraft, LocalPhoto, SyncJob } from 'features/localFirst/types';

let counter = 0;
const dbName = (): string => `sync-db-${counter++}`;
const material = new TextEncoder().encode('secret-session').buffer;
const okProvider: SessionKeyProvider = { getKeyMaterial: async () => material };
const sid = (s: string): DtoId['survey'] => s as DtoId['survey'];
const pid = (s: string): DtoId['photo'] => s as DtoId['photo'];
const flags: ExternalForceFlags = {
  houseWashedAway: false,
  groundScour: false,
  foundationWashout: false,
  fullCeilingInundation: false,
};

type Store = ReturnType<typeof createLocalDraftStore>;
const newStore = (): Store => createLocalDraftStore({ keyProvider: okProvider, dbName: dbName() });

const completeDraft = (id: string): LocalDraft => ({
  id,
  surveyType: 'first',
  input: {
    survey: { address: 'a', houseNumber: '1', structureType: 'wood' },
    firstSurvey: { externalForceFlags: flags },
  },
  progress: { currentStep: '', completedSteps: [], updatedAt: 0 },
  photoIds: [],
  syncState: 'editing',
  lastError: null,
  createdAt: 0,
  updatedAt: 0,
});

const photoWith = (id: string, draftId: string, status: LocalPhoto['status'], server: string | null): LocalPhoto => ({
  ...createLocalPhoto({
    id,
    draftId,
    fileName: `${id}.png`,
    contentType: 'image/png',
    blob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
    part: null,
    step: null,
    now: 1,
  }),
  status,
  serverPhotoId: server === null ? null : pid(server),
});

type Calls = { submit: number; put: string[]; confirm: DtoId['photo'][][] };

const makeService = (
  store: Store,
  opts: { tickets?: PhotoUploadTicket[]; fail?: () => boolean } = {},
): { svc: ReturnType<typeof createSyncService>; calls: Calls } => {
  const calls: Calls = { submit: 0, put: [], confirm: [] };
  const submit = async (_payload: SubmissionPayload): Promise<SubmissionResultDto> => {
    calls.submit += 1;
    if (opts.fail?.() === true) throw new Error('Boom');
    return { photoUploadTickets: opts.tickets ?? [] } as unknown as SubmissionResultDto;
  };
  const io: SyncIo & { genId: () => string; rng: () => number } = {
    store,
    submit,
    putObject: async (url) => {
      calls.put.push(url);
    },
    confirm: async (_surveyId, ids) => {
      calls.confirm.push(ids);
    },
    now: () => 1000,
    genId: () => `job-${counter}`,
    rng: () => 0.5,
  };
  return { svc: createSyncService(io), calls };
};

test('full 3-stage sync succeeds, uploads photo, confirms, and purges local data', async () => {
  const store = newStore();
  await store.putDraft(completeDraft('d'));
  await store.putPhoto(photoWith('p', 'd', 'local', null));
  const { svc, calls } = makeService(store, { tickets: [{ photoId: pid('sp1'), putUrl: 'https://put/1' }] });

  await svc.submit('d');

  expect(calls.submit).toBe(1);
  expect(calls.put).toStrictEqual(['https://put/1']);
  expect(calls.confirm).toStrictEqual([['sp1']]);
  expect(await store.getDraft('d')).toBeNull();
  expect(await store.listPhotos('d')).toStrictEqual([]);
  expect(await store.listJobs()).toStrictEqual([]);
});

test('sync with zero photos skips PUT and confirm', async () => {
  const store = newStore();
  await store.putDraft(completeDraft('d'));
  const { svc, calls } = makeService(store, { tickets: [] });

  await svc.submit('d');

  expect(calls.put).toStrictEqual([]);
  expect(calls.confirm).toStrictEqual([]);
  expect(await store.getDraft('d')).toBeNull();
});

test('already-uploaded/confirmed photos are skipped on resume (idempotent)', async () => {
  const store = newStore();
  await store.putDraft(completeDraft('d'));
  await store.putPhoto(photoWith('p1', 'd', 'uploaded', 's1'));
  await store.putPhoto(photoWith('p2', 'd', 'confirmed', 's2'));
  const job: SyncJob = {
    ...createJob({ id: 'j', draftId: 'd', surveyId: sid('d'), now: 0 }),
    stage: 'photos-put',
    uploadTickets: [
      { photoId: pid('s1'), putUrl: 'https://put/1' },
      { photoId: pid('s2'), putUrl: 'https://put/2' },
    ],
  };
  await store.putJob(job);
  const { svc, calls } = makeService(store);

  await svc.processJob('j');

  expect(calls.put).toStrictEqual([]); // both skipped
  expect(calls.confirm).toStrictEqual([['s1', 's2']]);
  expect(await store.getDraft('d')).toBeNull();
});

test('failure increments attempts, backs off, and marks draft queued (not exhausted)', async () => {
  const store = newStore();
  await store.putDraft(completeDraft('d'));
  const { svc } = makeService(store, { fail: () => true });

  await svc.submit('d');

  const job = await store.findJobByDraft('d');
  expect(job?.attempts).toBe(1);
  expect(job?.nextAttemptAt).toBe(1000 + 2000); // now + nextDelayMs(1, rng=0.5)
  expect(job?.lastError).toBe('Error');
  expect((await store.getDraft('d'))?.syncState).toBe('queued');
});

test('exhausted job marks the draft failed', async () => {
  const store = newStore();
  await store.putDraft(completeDraft('d'));
  await store.putJob({
    ...createJob({ id: 'j', draftId: 'd', surveyId: sid('d'), now: 0 }),
    attempts: 4,
  });
  const { svc } = makeService(store, { fail: () => true });

  await svc.processJob('j');

  expect((await store.findJobByDraft('d'))?.attempts).toBe(5);
  expect((await store.getDraft('d'))?.syncState).toBe('failed');
});

test('retry resets attempts and can succeed; no-op when there is no job', async () => {
  const store = newStore();
  await store.putDraft(completeDraft('d'));
  let failing = true;
  const { svc, calls } = makeService(store, { tickets: [], fail: () => failing });

  await svc.submit('d'); // fails -> queued job remains
  expect((await store.findJobByDraft('d'))?.attempts).toBe(1);

  failing = false;
  await svc.retry('d'); // succeeds -> purged
  expect(await store.getDraft('d')).toBeNull();
  expect(calls.submit).toBe(2);

  await svc.retry('gone'); // no job -> no throw
});

test('drainQueue processes only due jobs', async () => {
  const store = newStore();
  await store.putDraft(completeDraft('d1'));
  await store.putDraft(completeDraft('d2'));
  await store.putJob({ ...createJob({ id: 'due', draftId: 'd1', surveyId: sid('d1'), now: 0 }), nextAttemptAt: 0 });
  await store.putJob({ ...createJob({ id: 'later', draftId: 'd2', surveyId: sid('d2'), now: 0 }), nextAttemptAt: 999999 });
  const { svc, calls } = makeService(store, { tickets: [] });

  await svc.drainQueue();

  expect(calls.submit).toBe(1); // only the due job
  expect(await store.getDraft('d1')).toBeNull(); // processed + purged
  expect((await store.listJobs()).map((j) => j.id)).toStrictEqual(['later']);
});

test('processJob is a no-op when the job is missing', async () => {
  const store = newStore();
  const { svc, calls } = makeService(store);
  await svc.processJob('ghost');
  expect(calls.submit).toBe(0);
});

test('submit throws when the draft is missing', async () => {
  const store = newStore();
  const { svc } = makeService(store);
  await expect(svc.submit('missing')).rejects.toThrow('draft-not-found');
});

test('runSubmission throws when the draft is gone', async () => {
  const store = newStore();
  const io: SyncIo = {
    store,
    submit: async () => ({ photoUploadTickets: [] }) as unknown as SubmissionResultDto,
    putObject: async () => undefined,
    confirm: async () => undefined,
    now: () => 1,
  };
  const job = createJob({ id: 'j', draftId: 'ghost', surveyId: sid('ghost'), now: 0 });
  await expect(runSubmission(io, job)).rejects.toThrow('draft-not-found');
});

test('upload tickets without a matching local photo are skipped', async () => {
  const store = newStore();
  await store.putDraft(completeDraft('d'));
  await store.putPhoto(photoWith('p', 'd', 'local', null));
  const { svc, calls } = makeService(store, {
    tickets: [
      { photoId: pid('sp1'), putUrl: 'https://put/1' },
      { photoId: pid('sp2'), putUrl: 'https://put/2' }, // surplus: no matching photo
    ],
  });

  await svc.submit('d');

  expect(calls.put).toStrictEqual(['https://put/1']);
  expect(calls.confirm).toStrictEqual([['sp1']]);
});

test('processJob tolerates a job whose draft is missing (setState no-op)', async () => {
  const store = newStore();
  await store.putJob(createJob({ id: 'j', draftId: 'nodraft', surveyId: sid('nodraft'), now: 0 }));
  const { svc } = makeService(store);

  await svc.processJob('j'); // runSubmission throws draft-not-found -> failure path with null draft

  expect((await store.findJobByDraft('nodraft'))?.attempts).toBe(1);
});

test('photos beyond available tickets stay unconfirmed (null serverPhotoId branch)', async () => {
  const store = newStore();
  await store.putDraft(completeDraft('d'));
  await store.putPhoto(photoWith('p1', 'd', 'local', null));
  await store.putPhoto(photoWith('p2', 'd', 'local', null));
  const { svc, calls } = makeService(store, { tickets: [{ photoId: pid('sp1'), putUrl: 'https://put/1' }] });

  await svc.submit('d');

  expect(calls.put).toStrictEqual(['https://put/1']); // only p1 uploaded
  expect(calls.confirm).toStrictEqual([['sp1']]); // p2 (serverPhotoId null) excluded
});

test('non-Error failures are classified safely as "unknown"', async () => {
  const store = newStore();
  await store.putDraft(completeDraft('d'));
  const svc = createSyncService({
    store,
    submit: async () => {
      const raw: unknown = 'boom-string';
      throw raw;
    },
    putObject: async () => undefined,
    confirm: async () => undefined,
    now: () => 1000,
    genId: () => 'jx',
    rng: () => 0.5,
  });

  await svc.submit('d');

  expect((await store.findJobByDraft('d'))?.lastError).toBe('unknown');
});
