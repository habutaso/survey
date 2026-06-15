import { useCallback, useState } from 'react';
import { localFirst } from '../compose';
import type { LocalDraftId } from '../types';

export const useSyncOnSubmit = (): {
  syncing: boolean;
  submit: (draftId: LocalDraftId) => Promise<void>;
  retry: (draftId: LocalDraftId) => Promise<void>;
} => {
  const [syncing, setSyncing] = useState(false);

  const run = useCallback(async (action: () => Promise<void>): Promise<void> => {
    setSyncing(true);
    try {
      await action();
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    syncing,
    submit: useCallback((draftId) => run(() => localFirst.syncService.submit(draftId)), [run]),
    retry: useCallback((draftId) => run(() => localFirst.syncService.retry(draftId)), [run]),
  };
};
