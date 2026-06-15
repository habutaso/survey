import type { DtoId } from 'common/types/brandedId';
import { useCallback, useEffect, useState } from 'react';
import { localFirst } from '../compose';
import { addPhotoId, applyUpdate, createDraft, removePhotoId } from '../model/localDraft';
import { createLocalPhoto, isImageType } from '../model/localPhoto';
import type {
  DraftInput,
  DraftProgress,
  LocalDraft,
  LocalDraftId,
  LocalPhotoId,
  LocalSurveyType,
} from '../types';

const { store } = localFirst;
type UpdatePatch = { input?: Partial<DraftInput>; progress?: DraftProgress };

export const useLocalDraft = (draftId?: LocalDraftId) => {
  const [draft, setDraft] = useState<LocalDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const isLocked = await store.isLocked();
    setLocked(isLocked);
    setDraft(isLocked || draftId === undefined ? null : await store.getDraft(draftId));
    setLoading(false);
  }, [draftId]);

  useEffect(() => void reload(), [reload]);

  const create = useCallback(
    async (surveyType: LocalSurveyType, parentSurveyId?: DtoId['survey']): Promise<LocalDraftId> => {
      const id = crypto.randomUUID();
      await store.putDraft(createDraft({ id, surveyType, now: Date.now(), parentSurveyId }));
      return id;
    },
    [],
  );

  const update = useCallback(
    async (patch: UpdatePatch): Promise<void> => {
      if (draft === null) return;
      const next = applyUpdate(draft, patch, Date.now());
      await store.putDraft(next);
      setDraft(next);
    },
    [draft],
  );

  const addPhoto = useCallback(
    async (file: File, meta: { part?: string; step?: string }): Promise<LocalPhotoId> => {
      if (draft === null) throw new Error('no-draft');
      if (!isImageType(file.type)) throw new Error('not-image');
      const id = crypto.randomUUID();
      await store.putPhoto(
        createLocalPhoto({
          id,
          draftId: draft.id,
          fileName: file.name,
          contentType: file.type,
          blob: file,
          part: meta.part ?? null,
          step: meta.step ?? null,
          now: Date.now(),
        }),
      );
      const next = addPhotoId(draft, id, Date.now());
      await store.putDraft(next);
      setDraft(next);
      return id;
    },
    [draft],
  );

  const removePhoto = useCallback(
    async (photoId: LocalPhotoId): Promise<void> => {
      if (draft === null) return;
      await store.deletePhoto(photoId);
      const next = removePhotoId(draft, photoId, Date.now());
      await store.putDraft(next);
      setDraft(next);
    },
    [draft],
  );

  const remove = useCallback(async (): Promise<void> => {
    if (draftId !== undefined) await store.deleteDraft(draftId);
    setDraft(null);
  }, [draftId]);

  return { draft, loading, locked, reload, create, update, addPhoto, removePhoto, remove };
};
