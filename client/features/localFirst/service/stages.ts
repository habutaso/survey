import type { DtoId } from 'common/types/brandedId';
import type { PhotoUploadTicket } from 'common/types/photo';
import type { SubmissionPayload, SubmissionResultDto } from 'common/types/survey';
import { markUploaded, toPhotoMeta } from '../model/localPhoto';
import { withConfirmed, withStage, withTickets } from '../model/syncJob';
import { toSubmissionPayload } from '../model/toPayload';
import type { LocalDraftStore } from '../store/localDraftStore';
import type { LocalPhoto, SyncJob } from '../types';

// 同期に必要な副作用境界（注入）。submission/PUT/confirm と store・時刻。
export type SyncIo = {
  store: LocalDraftStore;
  submit: (payload: SubmissionPayload) => Promise<SubmissionResultDto>;
  putObject: (url: string, blob: Blob, contentType: string) => Promise<void>;
  confirm: (surveyId: DtoId['survey'], photoIds: DtoId['photo'][]) => Promise<void>;
  now: () => number;
};

// 段1: 提出 POST。応答の photoUploadTickets を job に保持して photos-put へ。
export const runSubmission = async (io: SyncIo, job: SyncJob): Promise<SyncJob> => {
  const draft = await io.store.getDraft(job.draftId);
  if (draft === null) throw new Error('draft-not-found');
  const photos = await io.store.listPhotos(job.draftId);
  const result = await io.submit(toSubmissionPayload(draft, photos.map(toPhotoMeta)));
  const next = withStage(withTickets(job, result.photoUploadTickets, io.now()), 'photos-put', io.now());
  await io.store.putJob(next);
  return next;
};

const uploadOne = async (
  io: SyncIo,
  photo: LocalPhoto,
  ticket: PhotoUploadTicket,
): Promise<void> => {
  if (photo.status === 'uploaded' || photo.status === 'confirmed') return;
  await io.putObject(ticket.putUrl, photo.blob, photo.contentType);
  await io.store.putPhoto(markUploaded(photo, ticket.photoId));
};

const uploadAll = async (
  io: SyncIo,
  tickets: PhotoUploadTicket[],
  photos: LocalPhoto[],
): Promise<void> => {
  for (const [index, ticket] of tickets.entries()) {
    const photo = photos[index];
    if (photo !== undefined) await uploadOne(io, photo, ticket);
  }
};

// 段2: presigned PUT（未送信のみ・冪等）。
export const runPhotosPut = async (io: SyncIo, job: SyncJob): Promise<SyncJob> => {
  const photos = await io.store.listPhotos(job.draftId);
  await uploadAll(io, job.uploadTickets, photos);
  const next = withStage(job, 'confirm', io.now());
  await io.store.putJob(next);
  return next;
};

// 段3: confirm（uploaded 済み photoId 群・冪等）。写真ゼロなら no-op で done へ。
export const runConfirm = async (io: SyncIo, job: SyncJob): Promise<SyncJob> => {
  const photos = await io.store.listPhotos(job.draftId);
  const ids = photos.flatMap((p) => (p.serverPhotoId === null ? [] : [p.serverPhotoId]));
  if (ids.length > 0) await io.confirm(job.surveyId, ids);
  const next = withStage(withConfirmed(job, ids, io.now()), 'done', io.now());
  await io.store.putJob(next);
  return next;
};
