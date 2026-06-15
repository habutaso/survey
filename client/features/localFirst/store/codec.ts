import { decryptBlob, decryptJson, encryptBlob, encryptJson } from '../crypto/draftCrypto';
import type { DraftInput, DraftProgress, LocalDraft, LocalPhoto } from '../types';
import type { DraftRecord, PhotoRecord } from './db';

type DraftSecret = {
  input: DraftInput;
  progress: DraftProgress;
  photoIds: string[];
  lastError: string | null;
};

export const encodeDraft = async (key: CryptoKey, draft: LocalDraft): Promise<DraftRecord> => ({
  id: draft.id,
  surveyType: draft.surveyType,
  syncState: draft.syncState,
  createdAt: draft.createdAt,
  updatedAt: draft.updatedAt,
  enc: await encryptJson(key, {
    input: draft.input,
    progress: draft.progress,
    photoIds: draft.photoIds,
    lastError: draft.lastError,
  } satisfies DraftSecret),
});

export const decodeDraft = async (key: CryptoKey, record: DraftRecord): Promise<LocalDraft> => {
  const secret = await decryptJson<DraftSecret>(key, record.enc);
  return {
    id: record.id,
    surveyType: record.surveyType,
    syncState: record.syncState,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    input: secret.input,
    progress: secret.progress,
    photoIds: secret.photoIds,
    lastError: secret.lastError,
  };
};

export const encodePhoto = async (key: CryptoKey, photo: LocalPhoto): Promise<PhotoRecord> => ({
  id: photo.id,
  draftId: photo.draftId,
  status: photo.status,
  contentType: photo.contentType,
  fileName: photo.fileName,
  part: photo.part,
  step: photo.step,
  serverPhotoId: photo.serverPhotoId,
  createdAt: photo.createdAt,
  enc: await encryptBlob(key, photo.blob),
});

export const decodePhoto = async (key: CryptoKey, record: PhotoRecord): Promise<LocalPhoto> => ({
  id: record.id,
  draftId: record.draftId,
  fileName: record.fileName,
  contentType: record.contentType,
  part: record.part,
  step: record.step,
  blob: await decryptBlob(key, record.enc, record.contentType),
  status: record.status,
  serverPhotoId: record.serverPhotoId,
  createdAt: record.createdAt,
});
