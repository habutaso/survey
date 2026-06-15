import type { DtoId } from 'common/types/brandedId';
import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import type { EncryptedRecord } from '../crypto/draftCrypto';
import type { DraftSyncState, LocalPhotoStatus, LocalSurveyType, SyncJob } from '../types';

// drafts の保存値（PII を含まない平文メタ＋暗号封筒 enc）。
export type DraftRecord = {
  id: string;
  surveyType: LocalSurveyType;
  syncState: DraftSyncState;
  createdAt: number;
  updatedAt: number;
  enc: EncryptedRecord; // { input, progress, photoIds, lastError } を暗号化
};

// photos の保存値（PII を含まないメタ＋画像バイナリ暗号封筒 enc）。
export type PhotoRecord = {
  id: string;
  draftId: string;
  status: LocalPhotoStatus;
  contentType: string;
  fileName: string;
  part: string | null;
  step: string | null;
  serverPhotoId: DtoId['photo'] | null;
  createdAt: number;
  enc: EncryptedRecord; // 画像 Blob を暗号化
};

export type MetaRecord = { key: string; value: Uint8Array };

export interface LocalDb extends DBSchema {
  drafts: { key: string; value: DraftRecord; indexes: { 'by-updatedAt': number } };
  photos: { key: string; value: PhotoRecord; indexes: { 'by-draftId': string } };
  syncQueue: { key: string; value: SyncJob; indexes: { 'by-draftId': string } };
  meta: { key: string; value: MetaRecord };
}

const SALT_KEY = 'kdfSalt';
const SALT_BYTES = 16;

export const openLocalDb = (name: string): Promise<IDBPDatabase<LocalDb>> =>
  openDB<LocalDb>(name, 1, {
    upgrade(database) {
      database.createObjectStore('drafts', { keyPath: 'id' }).createIndex('by-updatedAt', 'updatedAt');
      database.createObjectStore('photos', { keyPath: 'id' }).createIndex('by-draftId', 'draftId');
      database
        .createObjectStore('syncQueue', { keyPath: 'id' })
        .createIndex('by-draftId', 'draftId');
      database.createObjectStore('meta', { keyPath: 'key' });
    },
  });

// KDF salt を取得（無ければランダム生成して永続化）。salt は非機微（BR-U6f-2）。
export const ensureSalt = async (database: IDBPDatabase<LocalDb>): Promise<Uint8Array> => {
  const existing = await database.get('meta', SALT_KEY);
  if (existing !== undefined) return existing.value;
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  await database.put('meta', { key: SALT_KEY, value: salt });
  return salt;
};
