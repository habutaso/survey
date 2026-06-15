'use client';

import { Btn } from 'components/btn/Btn';
import { Loading } from 'components/loading/Loading';
import { useLocalDraft, useSyncOnSubmit } from 'features/localFirst';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  canNavigate,
  completedSteps,
  firstIncomplete,
  nextStep,
  prevStep,
  type StepKey,
  stepsFor,
} from '../model/wizardSteps';
import { NetworkBanner } from './NetworkBanner';
import { Stepper } from './Stepper';
import { FirstInputStep } from './steps/FirstInputStep';
import { FloorsStep } from './steps/FloorsStep';
import { HouseStep } from './steps/HouseStep';
import { PhotosStep } from './steps/PhotosStep';
import { ReviewStep } from './steps/ReviewStep';
import { SecondInputStep } from './steps/SecondInputStep';
import { VictimStep } from './steps/VictimStep';

// eslint-disable-next-line complexity -- ウィザード統括（ステップ分岐・ガードが本質）
export const SurveyWizard = (props: { draftId: string; onSubmitted: () => void }) => {
  const { draft, loading, locked, update, addPhoto, removePhoto } = useLocalDraft(props.draftId);
  const { submit, retry, syncing } = useSyncOnSubmit();
  const [selected, setSelected] = useState<StepKey | null>(null);

  if (loading) return <Loading visible />;
  if (locked) return <p>ロック中です。再ログインしてください。</p>;
  if (draft === null) return <p>下書きが見つかりませんでした。</p>;

  const steps = stepsFor(draft.surveyType, draft.input.survey.floors);
  const done = completedSteps(steps, draft);
  const current = selected ?? firstIncomplete(steps, draft);

  const onSubmit = (): void => {
    submit(draft.id)
      .then(props.onSubmitted)
      .catch(() => undefined);
  };

  const views: Record<StepKey, ReactNode> = {
    house: <HouseStep draft={draft} update={update} />,
    victim: <VictimStep draft={draft} update={update} />,
    firstInput: <FirstInputStep draft={draft} update={update} />,
    secondInput: <SecondInputStep draft={draft} update={update} />,
    photos: <PhotosStep draft={draft} addPhoto={addPhoto} removePhoto={removePhoto} />,
    floors: <FloorsStep draft={draft} update={update} />,
    review: (
      <ReviewStep
        draft={draft}
        syncing={syncing}
        onSubmit={onSubmit}
        onRetry={() => void retry(draft.id)}
      />
    ),
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <NetworkBanner />
      <Stepper
        steps={steps}
        current={current}
        completed={done}
        canSelect={(step) => canNavigate(steps, draft, step)}
        onSelect={setSelected}
      />
      <div style={{ marginTop: 16 }}>{views[current]}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <Btn text="戻る" size="small" onClick={() => setSelected(prevStep(steps, current))} />
        {current === 'review' ? null : (
          <Btn text="次へ" size="small" onClick={() => setSelected(nextStep(steps, current))} />
        )}
      </div>
    </div>
  );
};
