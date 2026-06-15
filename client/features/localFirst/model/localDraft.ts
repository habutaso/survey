import type { DtoId } from 'common/types/brandedId';
import type { DraftInput, DraftProgress, LocalDraft, LocalDraftId, LocalSurveyType } from '../types';

const initialProgress = (now: number): DraftProgress => ({
  currentStep: '',
  completedSteps: [],
  updatedAt: now,
});

// 新規下書きを生成する（syncState='editing'）。第2次は parentSurveyId を初期入力に保持。
export const createDraft = (params: {
  id: LocalDraftId;
  surveyType: LocalSurveyType;
  now: number;
  parentSurveyId?: DtoId['survey'];
}): LocalDraft => ({
  id: params.id,
  surveyType: params.surveyType,
  input: {
    survey:
      params.parentSurveyId === undefined ? {} : { parentSurveyId: params.parentSurveyId },
  },
  progress: initialProgress(params.now),
  photoIds: [],
  syncState: 'editing',
  lastError: null,
  createdAt: params.now,
  updatedAt: params.now,
});

const mergeInput = (base: DraftInput, patch: Partial<DraftInput> | undefined): DraftInput => {
  if (patch === undefined) return base;
  return {
    survey: { ...base.survey, ...patch.survey },
    firstSurvey:
      patch.firstSurvey === undefined
        ? base.firstSurvey
        : { ...base.firstSurvey, ...patch.firstSurvey },
    secondSurvey:
      patch.secondSurvey === undefined
        ? base.secondSurvey
        : { ...base.secondSurvey, ...patch.secondSurvey },
  };
};

// 入力/進捗をマージして自動保存用の新しい下書きを返す（BR-U6f-5）。
export const applyUpdate = (
  draft: LocalDraft,
  patch: { input?: Partial<DraftInput>; progress?: DraftProgress },
  now: number,
): LocalDraft => ({
  ...draft,
  input: mergeInput(draft.input, patch.input),
  progress: patch.progress ?? draft.progress,
  updatedAt: now,
});

export const withSyncState = (
  draft: LocalDraft,
  syncState: LocalDraft['syncState'],
  lastError: string | null,
  now: number,
): LocalDraft => ({ ...draft, syncState, lastError, updatedAt: now });

export const addPhotoId = (draft: LocalDraft, photoId: string, now: number): LocalDraft => ({
  ...draft,
  photoIds: [...draft.photoIds, photoId],
  updatedAt: now,
});

export const removePhotoId = (draft: LocalDraft, photoId: string, now: number): LocalDraft => ({
  ...draft,
  photoIds: draft.photoIds.filter((id) => id !== photoId),
  updatedAt: now,
});
