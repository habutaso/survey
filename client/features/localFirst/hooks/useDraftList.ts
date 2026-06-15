import { useCallback, useEffect, useState } from 'react';
import { localFirst } from '../compose';
import type { LocalDraftSummary } from '../types';

export const useDraftList = (): {
  drafts: LocalDraftSummary[];
  loading: boolean;
  reload: () => void;
} => {
  const [drafts, setDrafts] = useState<LocalDraftSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setDrafts(await localFirst.store.listDrafts());
    setLoading(false);
  }, []);

  useEffect(() => void reload(), [reload]);

  return { drafts, loading, reload: () => void reload() };
};
