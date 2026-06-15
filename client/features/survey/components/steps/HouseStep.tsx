'use client';

import { STRUCTURE_TYPE_DISPLAY, STRUCTURE_TYPE_LIST } from 'common/constants';
import type { StructureType } from 'common/types/survey';
import { Field, NumberInput, SelectInput, TextInput } from '../formKit';
import type { StepProps } from './types';

export const HouseStep = ({ draft, update }: StepProps) => {
  const s = draft.input.survey;
  const setSurvey = (patch: Partial<typeof s>): void => void update({ input: { survey: patch } });
  const captureGps = (): void =>
    navigator.geolocation.getCurrentPosition((p) =>
      setSurvey({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
    );

  return (
    <section>
      <h2>家屋情報</h2>
      <Field label="住所 *">
        <TextInput value={s.address ?? ''} onChange={(v) => setSurvey({ address: v })} />
      </Field>
      <Field label="家屋番号 *">
        <TextInput value={s.houseNumber ?? ''} onChange={(v) => setSurvey({ houseNumber: v })} />
      </Field>
      <Field label="構造種別 *">
        <SelectInput<StructureType>
          value={s.structureType}
          options={STRUCTURE_TYPE_LIST}
          labels={STRUCTURE_TYPE_DISPLAY}
          placeholder="選択してください"
          onChange={(v) => setSurvey({ structureType: v })}
        />
      </Field>
      <Field label="建物名">
        <TextInput value={s.buildingName ?? ''} onChange={(v) => setSurvey({ buildingName: v })} />
      </Field>
      <Field label="階数">
        <NumberInput value={s.floors} onChange={(v) => setSurvey({ floors: v })} />
      </Field>
      <button onClick={captureGps}>現在地（GPS）を取得</button>
      {s.latitude !== undefined ? (
        <p style={{ fontSize: 12 }}>
          緯度 {s.latitude} / 経度 {s.longitude}
        </p>
      ) : null}
    </section>
  );
};
