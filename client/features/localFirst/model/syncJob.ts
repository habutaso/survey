import type { DtoId } from 'common/types/brandedId';
import type { PhotoUploadTicket } from 'common/types/photo';
import type { LocalDraftId, SyncJob, SyncJobId, SyncStage } from '../types';
import { nextDelayMs, shouldRetry } from './backoff';

export const createJob = (params: {
  id: SyncJobId;
  draftId: LocalDraftId;
  surveyId: DtoId['survey'];
  now: number;
}): SyncJob => ({
  id: params.id,
  draftId: params.draftId,
  surveyId: params.surveyId,
  stage: 'submission',
  attempts: 0,
  nextAttemptAt: params.now,
  uploadTickets: [],
  confirmedPhotoIds: [],
  lastError: null,
  createdAt: params.now,
  updatedAt: params.now,
});

// 段階遷移（前段成功）。lastError をクリア（BR-U6f-7 段階再開）。
export const withStage = (job: SyncJob, stage: SyncStage, now: number): SyncJob => ({
  ...job,
  stage,
  lastError: null,
  updatedAt: now,
});

export const withTickets = (
  job: SyncJob,
  uploadTickets: PhotoUploadTicket[],
  now: number,
): SyncJob => ({ ...job, uploadTickets, updatedAt: now });

export const withConfirmed = (
  job: SyncJob,
  confirmedPhotoIds: DtoId['photo'][],
  now: number,
): SyncJob => ({ ...job, confirmedPhotoIds, updatedAt: now });

// 失敗記録: attempts++ と指数バックオフで nextAttemptAt を更新（stage は据置＝段階再開）。
export const recordFailure = (
  job: SyncJob,
  error: string,
  now: number,
  rng?: () => number,
): SyncJob => {
  const attempts = job.attempts + 1;
  return {
    ...job,
    attempts,
    lastError: error,
    nextAttemptAt: now + nextDelayMs(attempts, rng),
    updatedAt: now,
  };
};

// 手動再試行: attempts をリセットし即時 due にする（BR-U6f-7）。
export const resetForRetry = (job: SyncJob, now: number): SyncJob => ({
  ...job,
  attempts: 0,
  nextAttemptAt: now,
  lastError: null,
  updatedAt: now,
});

export const isExhausted = (job: SyncJob): boolean => !shouldRetry(job.attempts);

// due（nextAttemptAt<=now かつ未完了）かつ未完了ジョブを抽出（drainQueue 用）。
export const isDue = (job: SyncJob, now: number): boolean =>
  job.stage !== 'done' && job.nextAttemptAt <= now;
