'use client';

import type { FloorRatio } from 'common/types/survey';
import { NumberInput } from '../formKit';
import type { StepProps } from './types';

// eslint-disable-next-line complexity -- 表示専用コンポーネント（区分別の入力先分岐）
export const FloorsStep = ({ draft, update }: StepProps) => {
  const apportionment =
    (draft.surveyType === 'first'
      ? draft.input.firstSurvey?.floorApportionment
      : draft.input.secondSurvey?.floorApportionment) ?? [];
  const setFloors = (next: FloorRatio[]): void =>
    void update({
      input:
        draft.surveyType === 'first'
          ? { firstSurvey: { floorApportionment: next } }
          : { secondSurvey: { floorApportionment: next } },
    });
  const updateRow = (index: number, patch: Partial<FloorRatio>): void =>
    setFloors(apportionment.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  const sum = apportionment.reduce((acc, f) => acc + f.ratio, 0);

  return (
    <section>
      <h2>階按分（床面積比率）</h2>
      {apportionment.map((row, index) => (
        <div key={index} style={{ display: 'flex', gap: 8, margin: '6px 0' }}>
          <div style={{ flex: 1 }}>
            <NumberInput
              value={row.floor}
              onChange={(v) => updateRow(index, { floor: v ?? 1 })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <NumberInput
              value={row.ratio}
              onChange={(v) => updateRow(index, { ratio: v ?? 0 })}
            />
          </div>
          <button onClick={() => setFloors(apportionment.filter((_, i) => i !== index))}>削除</button>
        </div>
      ))}
      <button onClick={() => setFloors([...apportionment, { floor: apportionment.length + 1, ratio: 0 }])}>
        階を追加
      </button>
      <p style={{ color: sum === 100 ? '#070' : '#b00' }}>合計: {sum}%（100% にしてください）</p>
    </section>
  );
};
