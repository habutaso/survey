import type { DraftInput, LocalDraft } from 'features/localFirst';

export type StepUpdate = (patch: { input?: Partial<DraftInput> }) => Promise<void>;

export type StepProps = {
  draft: LocalDraft;
  update: StepUpdate;
};
