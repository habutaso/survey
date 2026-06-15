'use client';

import type { ExternalForceFlags } from 'common/types/survey';
import { CheckboxField, Field, NumberInput } from '../formKit';
import type { StepProps } from './types';

const FLAG_LABELS: Record<keyof ExternalForceFlags, string> = {
  houseWashedAway: '住家流失',
  groundScour: '地盤洗掘',
  foundationWashout: '基礎流失',
  fullCeilingInundation: '全部の階の天井までの浸水',
};

const EMPTY_FLAGS: ExternalForceFlags = {
  houseWashedAway: false,
  groundScour: false,
  foundationWashout: false,
  fullCeilingInundation: false,
};

const FLAG_KEYS = Object.keys(EMPTY_FLAGS) as (keyof ExternalForceFlags)[];

export const FirstInputStep = ({ draft, update }: StepProps) => {
  const first = draft.input.firstSurvey;
  const flags = first?.externalForceFlags ?? EMPTY_FLAGS;
  const setFlag = (key: keyof ExternalForceFlags, value: boolean): void =>
    void update({ input: { firstSurvey: { externalForceFlags: { ...flags, [key]: value } } } });

  return (
    <section>
      <h2>第1次調査入力</h2>
      <Field label="外力・流失等の該当（全壊判定）">
        <div>
          {FLAG_KEYS.map((key) => (
            <CheckboxField
              key={key}
              label={FLAG_LABELS[key]}
              checked={flags[key]}
              onChange={(v) => setFlag(key, v)}
            />
          ))}
        </div>
      </Field>
      <Field label="傾斜の実測値（比率）">
        <NumberInput
          value={first?.tiltRatio}
          onChange={(v) => void update({ input: { firstSurvey: { tiltRatio: v } } })}
        />
      </Field>
      <Field label="浸水深（cm）">
        <NumberInput
          value={first?.inundationDepthCm}
          onChange={(v) => void update({ input: { firstSurvey: { inundationDepthCm: v } } })}
        />
      </Field>
    </section>
  );
};
