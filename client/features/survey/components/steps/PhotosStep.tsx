'use client';

import type { LocalDraft, LocalPhotoId } from 'features/localFirst';
import { useState } from 'react';

export const PhotosStep = (props: {
  draft: LocalDraft;
  addPhoto: (file: File, meta: { part?: string; step?: string }) => Promise<LocalPhotoId>;
  removePhoto: (photoId: LocalPhotoId) => Promise<void>;
}) => {
  const [part, setPart] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file === undefined) return;
    setError(null);
    props.addPhoto(file, { part: part === '' ? undefined : part }).catch(() => setError('画像のみ添付できます'));
  };

  return (
    <section>
      <h2>写真の撮影・添付</h2>
      <p style={{ fontSize: 12, color: '#555' }}>部位名（任意）を入力してから画像を選択すると紐付きます。</p>
      <input value={part} placeholder="部位名（任意）" onChange={(e) => setPart(e.target.value)} />
      <input type="file" accept="image/*" capture="environment" onChange={onFile} />
      {error !== null ? <p style={{ color: '#b00' }}>{error}</p> : null}
      <p>添付済み: {props.draft.photoIds.length} 枚</p>
      <ul>
        {props.draft.photoIds.map((id) => (
          <li key={id}>
            {id}
            <button onClick={() => void props.removePhoto(id)}>削除</button>
          </li>
        ))}
      </ul>
    </section>
  );
};
