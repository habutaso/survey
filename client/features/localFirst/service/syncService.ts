import type { DtoId } from 'common/types/brandedId';
import { withSyncState } from '../model/localDraft';
import { createJob, isDue, isExhausted, recordFailure, resetForRetry } from '../model/syncJob';
import type { LocalDraftId, SyncJob, SyncStage } from '../types';
import { runConfirm, runPhotosPut, runSubmission, type SyncIo } from './stages';

export type SyncServiceDeps = SyncIo & { genId: () => string; rng?: () => number };

export type SyncService = {
  submit: (draftId: LocalDraftId) => Promise<void>;
  retry: (draftId: LocalDraftId) => Promise<void>;
  processJob: (jobId: string) => Promise<void>;
  drainQueue: () => Promise<void>;
};

type ActiveStage = Exclude<SyncStage, 'done'>;

const STAGE_RUNNERS: Record<ActiveStage, (io: SyncIo, job: SyncJob) => Promise<SyncJob>> = {
  submission: runSubmission,
  'photos-put': runPhotosPut,
  confirm: runConfirm,
};

// 安全なエラー分類（PII/詳細を漏らさない, BR-U6f-13）。
const classifyError = (error: unknown): string =>
  error instanceof Error ? error.name : 'unknown';

export const createSyncService = (deps: SyncServiceDeps): SyncService => {
  const setState = async (
    draftId: string,
    state: 'queued' | 'syncing' | 'failed',
    error: string | null,
  ): Promise<void> => {
    const draft = await deps.store.getDraft(draftId);
    if (draft !== null) await deps.store.putDraft(withSyncState(draft, state, error, deps.now()));
  };

  const advance = async (start: SyncJob): Promise<void> => {
    let job = start;
    while (job.stage !== 'done') {
      job = await STAGE_RUNNERS[job.stage](deps, job);
    }
    // FR-19: 同期成功確認後にのみローカル PII/画像を消去（INV-U6f-5）。
    await deps.store.purgeLocal(job.draftId);
    await deps.store.deleteJob(job.id);
  };

  const handleFailure = async (job: SyncJob, error: unknown): Promise<void> => {
    const failed = recordFailure(job, classifyError(error), deps.now(), deps.rng);
    await deps.store.putJob(failed);
    await setState(job.draftId, isExhausted(failed) ? 'failed' : 'queued', failed.lastError);
  };

  const processJob = async (jobId: string): Promise<void> => {
    const job = await deps.store.getJob(jobId);
    if (job === null) return;
    await setState(job.draftId, 'syncing', null);
    try {
      await advance(job);
    } catch (error) {
      await handleFailure(job, error);
    }
  };

  const submit = async (draftId: LocalDraftId): Promise<void> => {
    const draft = await deps.store.getDraft(draftId);
    if (draft === null) throw new Error('draft-not-found');
    const job = createJob({
      id: deps.genId(),
      draftId,
      surveyId: draft.id as DtoId['survey'],
      now: deps.now(),
    });
    await deps.store.putJob(job);
    await setState(draftId, 'queued', null);
    await processJob(job.id);
  };

  const retry = async (draftId: LocalDraftId): Promise<void> => {
    const job = await deps.store.findJobByDraft(draftId);
    if (job === null) return;
    const reset = resetForRetry(job, deps.now());
    await deps.store.putJob(reset);
    await processJob(reset.id);
  };

  const drainQueue = async (): Promise<void> => {
    const due = (await deps.store.listJobs()).filter((job) => isDue(job, deps.now()));
    for (const job of due) await processJob(job.id);
  };

  return { submit, retry, processJob, drainQueue };
};
