'use client';

import type { StepKey } from '../model/wizardSteps';

const STEP_LABELS: Record<StepKey, string> = {
  house: '家屋情報',
  victim: '被災者情報',
  firstInput: '第1次入力',
  secondInput: '第2次入力',
  photos: '写真',
  floors: '階按分',
  review: '確認・提出',
};

const colorFor = (isCurrent: boolean, isDone: boolean): string =>
  isCurrent ? '#1565c0' : isDone ? '#2e7d32' : '#999';

export const Stepper = (props: {
  steps: StepKey[];
  current: StepKey;
  completed: StepKey[];
  canSelect: (step: StepKey) => boolean;
  onSelect: (step: StepKey) => void;
}) => (
  <ol style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0, flexWrap: 'wrap' }}>
    {props.steps.map((step) => {
      const isCurrent = step === props.current;
      const isDone = props.completed.includes(step);
      return (
        <li key={step}>
          <button
            disabled={!props.canSelect(step)}
            onClick={() => props.onSelect(step)}
            style={{
              border: 'none',
              background: 'none',
              cursor: props.canSelect(step) ? 'pointer' : 'default',
              fontWeight: isCurrent ? 700 : 400,
              color: colorFor(isCurrent, isDone),
            }}
          >
            {STEP_LABELS[step]}
            {isDone ? ' ✓' : ''}
          </button>
        </li>
      );
    })}
  </ol>
);
