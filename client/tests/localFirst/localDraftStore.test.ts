import type { DtoId } from 'common/types/brandedId';
import { expect, test } from 'vitest';
import type { SessionKeyProvider } from 'features/localFirst/crypto/sessionKeyProvider';
import { createDraft, applyUpdate } from 'features/localFirst/model/localDraft';
import { createLocalPhoto } from 'features/localFirst/model/localPhoto';
import { createJob } from 'features/localFirst/model/syncJob';
import { createLocalDraftStore, LockedError } from 'features/localFirst/store/localDraftStore';

let counter = 0;
const dbName = (): string => `test-db-${counter++}`;
const material = new TextEncoder().encode('secret-session').buffer;
const okProvider: SessionKeyProvider = { getKeyMaterial: async () => material };
const lockedProvider: SessionKeyProvider = {
  getKeyMaterial: async () => {
    throw new Error('no-session');
  },
};
const sid = (s: string): DtoId['survey'] => s as DtoId['survey'];

const newStore = (name = dbName()): ReturnType<typeof createLocalDraftStore> =>
  createLocalDraftStore({ keyProvider: okProvider, dbName: name });

const imageBlob = (bytes: number[]): Blob => new Blob([new Uint8Array(bytes)], { type: 'image/png' });

const photo = (id: string, draftId: string, now: number, bytes: number[]) =>
  createLocalPhoto({
    id,
    draftId,
    fileName: `${id}.png`,
    contentType: 'image/png',
    blob: imageBlob(bytes),
    part: null,
    step: null,
    now,
  });

test('puts and retrieves an encrypted draft; missing id returns null; not locked', async () => {
  const store = newStore();
  await store.putDraft(createDraft({ id: 'd1', surveyType: 'first', now: 1 }));
  expect((await store.getDraft('d1'))?.id).toBe('d1');
  expect(await store.getDraft('missing')).toBeNull();
  expect(await store.isLocked()).toBe(false);
});

test('listDrafts returns PII-free summaries (no plaintext PII at rest)', async () => {
  const store = newStore();
  const draft = applyUpdate(
    createDraft({ id: 'd1', surveyType: 'first', now: 1 }),
    { input: { survey: { victimName: 'SECRET-NAME', address: 'SECRET-ADDR' } } },
    2,
  );
  await store.putDraft(draft);
  const list = await store.listDrafts();
  expect(list).toHaveLength(1);
  expect(list[0]?.surveyType).toBe('first');
  expect(JSON.stringify(list)).not.toContain('SECRET-NAME');
});

test('locked store: isLocked true, getDraft throws LockedError, listDrafts works', async () => {
  const store = createLocalDraftStore({ keyProvider: lockedProvider, dbName: dbName() });
  expect(await store.isLocked()).toBe(true);
  await expect(store.getDraft('x')).rejects.toBeInstanceOf(LockedError);
  expect(await store.listDrafts()).toStrictEqual([]);
});

test('photos round-trip, sorted by createdAt then id; delete', async () => {
  const store = newStore();
  await store.putPhoto(photo('p2', 'd', 2, [9]));
  await store.putPhoto(photo('p1', 'd', 1, [1, 2, 3]));
  await store.putPhoto(photo('p3a', 'd', 1, [7])); // same createdAt as p1 -> localeCompare
  const list = await store.listPhotos('d');
  expect(list.map((p) => p.id)).toStrictEqual(['p1', 'p3a', 'p2']);
  const got = await store.getPhoto('p1');
  expect(new Uint8Array(await got!.blob.arrayBuffer())).toStrictEqual(new Uint8Array([1, 2, 3]));
  expect(await store.getPhoto('nope')).toBeNull();
  await store.deletePhoto('p1');
  expect(await store.getPhoto('p1')).toBeNull();
});

test('jobs: put/get/find/list/delete', async () => {
  const store = newStore();
  await store.putJob(createJob({ id: 'j1', draftId: 'd', surveyId: sid('d'), now: 0 }));
  expect((await store.getJob('j1'))?.id).toBe('j1');
  expect(await store.getJob('nope')).toBeNull();
  expect((await store.findJobByDraft('d'))?.id).toBe('j1');
  expect(await store.findJobByDraft('other')).toBeNull();
  expect(await store.listJobs()).toHaveLength(1);
  await store.deleteJob('j1');
  expect(await store.listJobs()).toHaveLength(0);
});

test('deleteDraft removes a draft', async () => {
  const store = newStore();
  await store.putDraft(createDraft({ id: 'd1', surveyType: 'first', now: 1 }));
  await store.deleteDraft('d1');
  expect(await store.getDraft('d1')).toBeNull();
});

test('purgeLocal deletes draft, photos, and the job', async () => {
  const store = newStore();
  await store.putDraft(createDraft({ id: 'd', surveyType: 'first', now: 1 }));
  await store.putPhoto(photo('p', 'd', 1, [1]));
  await store.putJob(createJob({ id: 'j', draftId: 'd', surveyId: sid('d'), now: 0 }));
  await store.purgeLocal('d');
  expect(await store.getDraft('d')).toBeNull();
  expect(await store.listPhotos('d')).toStrictEqual([]);
  expect(await store.listJobs()).toStrictEqual([]);
});

test('purgeLocal without a job still clears draft and photos', async () => {
  const store = newStore();
  await store.putDraft(createDraft({ id: 'd2', surveyType: 'first', now: 1 }));
  await store.putPhoto(photo('p', 'd2', 1, [1]));
  await store.purgeLocal('d2');
  expect(await store.getDraft('d2')).toBeNull();
  expect(await store.listPhotos('d2')).toStrictEqual([]);
});

test('clearAll works both when fresh (no db) and after use', async () => {
  const name = dbName();
  const store = newStore(name);
  await store.clearAll(); // dbPromise === null branch
  await store.putDraft(createDraft({ id: 'd', surveyType: 'first', now: 1 })); // reopen
  expect(await store.getDraft('d')).not.toBeNull();
  await store.clearAll(); // dbPromise !== null branch
  expect(await newStore(name).listDrafts()).toStrictEqual([]);
});

test('salt is persisted and reused across store instances (decrypts with same key)', async () => {
  const name = dbName();
  const first = newStore(name);
  await first.putDraft(createDraft({ id: 'd', surveyType: 'first', now: 1 })); // generates salt
  const second = newStore(name); // reads existing salt -> same derived key
  expect((await second.getDraft('d'))?.id).toBe('d');
});

test('defaults the database name when none is provided', async () => {
  const store = createLocalDraftStore({ keyProvider: okProvider });
  expect(await store.listDrafts()).toStrictEqual([]);
  await store.clearAll();
});
