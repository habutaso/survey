'use client';

import { SURVEY_TYPE_DISPLAY } from 'common/constants';
import { Btn } from 'components/btn/Btn';
import type { LocalDraft } from 'features/localFirst';

const SYNC_LABELS: Record<LocalDraft['syncState'], string> = {
  editing: '編集中',
  queued: '送信待ち（オフライン時は復帰後に自動再開）',
  syncing: '同期中…',
  synced: '同期完了',
  failed: '同期失敗',
};

// eslint-disable-next-line complexity -- 表示専用コンポーネント（条件付きレンダリングが本質）
export const ReviewStep = (props: {
  draft: LocalDraft;
  syncing: boolean;
  onSubmit: () => void;
  onRetry: () => void;
}) => {
  const { draft } = props;
  return (
    <section>
      <h2>確認・提出</h2>
      <p>住所: {draft.input.survey.address ?? '(未入力)'}</p>
      <p>家屋番号: {draft.input.survey.houseNumber ?? '(未入力)'}</p>
      <p>調査区分: {SURVEY_TYPE_DISPLAY[draft.surveyType]}</p>
      <p>添付写真: {draft.photoIds.length} 枚</p>
      <p style={{ fontSize: 12, color: '#555' }}>
        損害割合・被害度区分は提出後にサーバで算出されます。
      </p>
      <p>同期状態: {SYNC_LABELS[draft.syncState]}</p>
      {draft.lastError !== null ? (
        <p style={{ color: '#b00' }}>エラー: {draft.lastError}</p>
      ) : null}
      <Btn text={props.syncing ? '同期中…' : '提出する'} disabled={props.syncing} onClick={props.onSubmit} />
      {draft.syncState === 'failed' ? <Btn text="再試行" onClick={props.onRetry} /> : null}
    </section>
  );
};
