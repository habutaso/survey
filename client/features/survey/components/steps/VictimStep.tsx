'use client';

import { Field, TextInput } from '../formKit';
import type { StepProps } from './types';

export const VictimStep = ({ draft, update }: StepProps) => {
  const s = draft.input.survey;
  const setSurvey = (patch: Partial<typeof s>): void => void update({ input: { survey: patch } });

  return (
    <section>
      <h2>被災者情報（任意）</h2>
      <p style={{ fontSize: 12, color: '#555' }}>
        入力内容は端末内で暗号化保存され、権限のない利用者には表示されません。
      </p>
      <Field label="氏名">
        <TextInput value={s.victimName ?? ''} onChange={(v) => setSurvey({ victimName: v })} />
      </Field>
      <Field label="連絡先">
        <TextInput value={s.victimContact ?? ''} onChange={(v) => setSurvey({ victimContact: v })} />
      </Field>
      <Field label="住所">
        <TextInput value={s.victimAddress ?? ''} onChange={(v) => setSurvey({ victimAddress: v })} />
      </Field>
    </section>
  );
};
