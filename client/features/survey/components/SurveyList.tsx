'use client';

import { SURVEY_STATUS_DISPLAY, SURVEY_STATUS_LIST } from 'common/constants';
import type { SurveyDto, SurveyListResult } from 'common/types/survey';
import type { SurveyListQuery } from 'common/validators/survey';
import { Btn } from 'components/btn/Btn';
import { useDraftList } from 'features/localFirst';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { pagesPath } from 'utils/$path';
import { apiClient } from 'utils/apiClient';
import { damageLevelLabel, formatDate, statusLabel, surveyTypeLabel } from '../model/display';

const PAGE_SIZE = 20;
type StatusFilter = SurveyDto['status'] | '';

// eslint-disable-next-line complexity -- 一覧/検索/ページングの条件付きレンダリングが本質
export const SurveyList = () => {
  const router = useRouter();
  const { drafts } = useDraftList();
  const [status, setStatus] = useState<StatusFilter>('');
  const [address, setAddress] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SurveyListResult | null>(null);

  const load = useCallback(async () => {
    const query: SurveyListQuery = {
      page,
      pageSize: PAGE_SIZE,
      ...(status === '' ? {} : { status }),
      ...(address === '' ? {} : { address }),
    };
    setResult(await apiClient.private.surveys.$get({ query }).catch(() => null));
  }, [page, status, address]);

  useEffect(() => void load(), [load]);

  const open = (id: string): void => router.push(pagesPath.surveys._surveyId(id).$url().path);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>調査一覧</h1>
        <Btn text="新規調査" onClick={() => router.push(pagesPath.surveys.new.$url().path)} />
      </div>

      {drafts.length > 0 ? (
        <section style={{ background: '#f5f5f5', padding: 12, borderRadius: 6 }}>
          <h2 style={{ fontSize: 16 }}>下書き（再開）</h2>
          {drafts.map((d) => (
            <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>{surveyTypeLabel(d.surveyType)} / 状態: {d.syncState}</span>
              <Btn
                text="再開"
                size="small"
                onClick={() => router.push(`${pagesPath.surveys.new.$url().path}?draftId=${d.id}`)}
              />
            </div>
          ))}
        </section>
      ) : null}

      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="">状態（すべて）</option>
          {SURVEY_STATUS_LIST.map((s) => (
            <option key={s} value={s}>
              {SURVEY_STATUS_DISPLAY[s]}
            </option>
          ))}
        </select>
        <input value={address} placeholder="住所で検索" onChange={(e) => setAddress(e.target.value)} />
        <Btn text="検索" size="small" onClick={() => setPage(1)} />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>住所</th>
            <th>区分</th>
            <th>状態</th>
            <th>被害度</th>
            <th>作成日</th>
          </tr>
        </thead>
        <tbody>
          {(result?.items ?? []).map((s) => (
            <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => open(s.id)}>
              <td>{s.address}</td>
              <td>{surveyTypeLabel(s.surveyType)}</td>
              <td>{statusLabel(s.status)}</td>
              <td>{damageLevelLabel(s.damageLevel)}</td>
              <td>{formatDate(s.createdTime)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
        <Btn text="前へ" size="small" disabled={page <= 1} onClick={() => setPage(page - 1)} />
        <span>{page} ページ（全 {result?.total ?? 0} 件）</span>
        <Btn
          text="次へ"
          size="small"
          disabled={result === null || page * PAGE_SIZE >= result.total}
          onClick={() => setPage(page + 1)}
        />
      </div>
    </div>
  );
};
