'use client';

import type { PartDamage } from 'common/types/survey';
import { NumberInput, TextInput } from '../formKit';
import type { StepProps } from './types';

export const SecondInputStep = ({ draft, update }: StepProps) => {
  const damages = draft.input.secondSurvey?.partDamages ?? [];
  const setDamages = (next: PartDamage[]): void =>
    void update({ input: { secondSurvey: { partDamages: next } } });
  const updateRow = (index: number, patch: Partial<PartDamage>): void =>
    setDamages(damages.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  return (
    <section>
      <h2>第2次調査入力（部位損傷率）</h2>
      {damages.map((row, index) => (
        <div key={index} style={{ display: 'flex', gap: 8, margin: '6px 0' }}>
          <div style={{ flex: 2 }}>
            <TextInput
              value={row.part}
              placeholder="部位（屋根・外壁・天井 等）"
              onChange={(v) => updateRow(index, { part: v })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <NumberInput
              value={row.damageRatio}
              onChange={(v) => updateRow(index, { damageRatio: v ?? 0 })}
            />
          </div>
          <button onClick={() => setDamages(damages.filter((_, i) => i !== index))}>削除</button>
        </div>
      ))}
      <button onClick={() => setDamages([...damages, { part: '', damageRatio: 0 }])}>
        部位を追加
      </button>
    </section>
  );
};
