import { deleteDB, type IDBPDatabase } from 'idb';
import { deriveKey } from '../crypto/draftCrypto';
import type { SessionKeyProvider } from '../crypto/sessionKeyProvider';
import type { LocalDraft, LocalDraftSummary, LocalPhoto, SyncJob } from '../types';
import { decodeDraft, decodePhoto, encodeDraft, encodePhoto } from './codec';
import { ensureSalt, type LocalDb, openLocalDb, type PhotoRecord } from './db';

// 鍵未取得（未ログイン/セッション終了）時に機微操作を拒否する例外（BR-U6f-9）。
export class LockedError extends Error {
  constructor() {
    super('local store is locked: encryption key unavailable');
    this.name = 'LockedError';
  }
}

export type LocalDraftStore = {
  isLocked: () => Promise<boolean>;
  getDraft: (id: string) => Promise<LocalDraft | null>;
  listDrafts: () => Promise<LocalDraftSummary[]>;
  putDraft: (draft: LocalDraft) => Promise<void>;
  deleteDraft: (id: string) => Promise<void>;
  putPhoto: (photo: LocalPhoto) => Promise<void>;
  getPhoto: (id: string) => Promise<LocalPhoto | null>;
  listPhotos: (draftId: string) => Promise<LocalPhoto[]>;
  deletePhoto: (id: string) => Promise<void>;
  putJob: (job: SyncJob) => Promise<void>;
  getJob: (id: string) => Promise<SyncJob | null>;
  findJobByDraft: (draftId: string) => Promise<SyncJob | null>;
  listJobs: () => Promise<SyncJob[]>;
  deleteJob: (id: string) => Promise<void>;
  purgeLocal: (draftId: string) => Promise<void>;
  clearAll: () => Promise<void>;
};

export type StoreDeps = { keyProvider: SessionKeyProvider; dbName?: string };

const byCreatedThenId = (a: PhotoRecord, b: PhotoRecord): number =>
  a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt - b.createdAt;

export const createLocalDraftStore = (deps: StoreDeps): LocalDraftStore => {
  const dbName = deps.dbName ?? 'survey-local';
  let dbPromise: Promise<IDBPDatabase<LocalDb>> | null = null;
  let cachedKey: CryptoKey | null = null;

  const db = (): Promise<IDBPDatabase<LocalDb>> => {
    dbPromise ??= openLocalDb(dbName);
    return dbPromise;
  };

  const keyOrNull = async (): Promise<CryptoKey | null> => {
    if (cachedKey !== null) return cachedKey;
    const material = await deps.keyProvider.getKeyMaterial().catch(() => null);
    if (material === null) return null;
    cachedKey = await deriveKey(material, await ensureSalt(await db()));
    return cachedKey;
  };

  const requireKey = async (): Promise<CryptoKey> => {
    const key = await keyOrNull();
    if (key === null) throw new LockedError();
    return key;
  };

  const getDraft = async (id: string): Promise<LocalDraft | null> => {
    const key = await requireKey();
    const record = await (await db()).get('drafts', id);
    return record === undefined ? null : decodeDraft(key, record);
  };

  const listDrafts = async (): Promise<LocalDraftSummary[]> => {
    const records = await (await db()).getAll('drafts');
    return records.map((r) => ({
      id: r.id,
      surveyType: r.surveyType,
      syncState: r.syncState,
      updatedAt: r.updatedAt,
    }));
  };

  const putDraft = async (draft: LocalDraft): Promise<void> => {
    await (await db()).put('drafts', await encodeDraft(await requireKey(), draft));
  };

  const getPhoto = async (id: string): Promise<LocalPhoto | null> => {
    const key = await requireKey();
    const record = await (await db()).get('photos', id);
    return record === undefined ? null : decodePhoto(key, record);
  };

  const listPhotos = async (draftId: string): Promise<LocalPhoto[]> => {
    const key = await requireKey();
    const records = await (await db()).getAllFromIndex('photos', 'by-draftId', draftId);
    return Promise.all([...records].sort(byCreatedThenId).map((r) => decodePhoto(key, r)));
  };

  const putPhoto = async (photo: LocalPhoto): Promise<void> => {
    await (await db()).put('photos', await encodePhoto(await requireKey(), photo));
  };

  const findJobByDraft = async (draftId: string): Promise<SyncJob | null> => {
    const jobs = await (await db()).getAllFromIndex('syncQueue', 'by-draftId', draftId);
    return jobs[0] ?? null;
  };

  const purgeLocal = async (draftId: string): Promise<void> => {
    const database = await db();
    const photos = await database.getAllFromIndex('photos', 'by-draftId', draftId);
    await Promise.all(photos.map((p) => database.delete('photos', p.id)));
    await database.delete('drafts', draftId);
    const job = await findJobByDraft(draftId);
    if (job !== null) await database.delete('syncQueue', job.id);
  };

  const clearAll = async (): Promise<void> => {
    if (dbPromise !== null) (await dbPromise).close();
    dbPromise = null;
    cachedKey = null;
    await deleteDB(dbName);
  };

  return {
    isLocked: async () => (await keyOrNull()) === null,
    getDraft,
    listDrafts,
    putDraft,
    deleteDraft: async (id) => (await db()).delete('drafts', id),
    putPhoto,
    getPhoto,
    listPhotos,
    deletePhoto: async (id) => (await db()).delete('photos', id),
    putJob: async (job) => {
      await (await db()).put('syncQueue', job);
    },
    getJob: async (id) => (await (await db()).get('syncQueue', id)) ?? null,
    findJobByDraft,
    listJobs: async () => (await db()).getAll('syncQueue'),
    deleteJob: async (id) => (await db()).delete('syncQueue', id),
    purgeLocal,
    clearAll,
  };
};
