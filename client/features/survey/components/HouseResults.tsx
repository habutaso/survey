'use client';

import type { DtoId } from 'common/types/brandedId';
import type { HouseResultsDto, SurveyDto } from 'common/types/survey';
import { Btn } from 'components/btn/Btn';
import { useUser } from 'hooks/useUser';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { pagesPath } from 'utils/$path';
import { apiClient } from 'utils/apiClient';
import { damageLevelLabel, damageRatioLabel, statusLabel, surveyTypeLabel } from '../model/display';

const surveysApi = (id: string) => apiClient.private.surveys._surveyId(id);
const cardBorder = (isOfficial: boolean): string => (isOfficial ? '2px solid #1565c0' : '1px solid #ccc');

const AdminCardActions = (props: {
  status: SurveyDto['status'];
  onApprove: () => void;
  onConfirm: () => void;
  onChooseOfficial: () => void;
}) => (
  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
    {props.status === 'submitted' ? <Btn text="承認" size="small" onClick={props.onApprove} /> : null}
    {props.status === 'approved' ? <Btn text="確定" size="small" onClick={props.onConfirm} /> : null}
    <Btn text="正式判定に選択" size="small" onClick={props.onChooseOfficial} />
  </div>
);

const SurveyCard = (props: {
  survey: SurveyDto;
  isAdmin: boolean;
  isOfficial: boolean;
  onApprove: () => void;
  onConfirm: () => void;
  onChooseOfficial: () => void;
}) => {
  const { survey } = props;
  return (
    <div style={{ border: cardBorder(props.isOfficial), padding: 12, margin: '8px 0' }}>
      <div style={{ fontWeight: 700 }}>
        {surveyTypeLabel(survey.surveyType)}
        {props.isOfficial ? '（正式判定）' : ''}
      </div>
      <div>状態: {statusLabel(survey.status)}</div>
      <div>
        損害割合: {damageRatioLabel(survey.damageRatio)} / 被害度: {damageLevelLabel(survey.damageLevel)}
      </div>
      {props.isAdmin ? (
        <AdminCardActions
          status={survey.status}
          onApprove={props.onApprove}
          onConfirm={props.onConfirm}
          onChooseOfficial={props.onChooseOfficial}
        />
      ) : null}
    </div>
  );
};

const ResultActions = (props: {
  isAdmin: boolean;
  onSecond: () => void;
  onPdf: () => void;
  onCsv: () => void;
  onBack: () => void;
}) => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
    <Btn text="第2次調査を開始" onClick={props.onSecond} />
    {props.isAdmin ? <Btn text="PDF 出力" onClick={props.onPdf} /> : null}
    {props.isAdmin ? <Btn text="CSV 出力" onClick={props.onCsv} /> : null}
    <Btn text="一覧へ戻る" onClick={props.onBack} />
  </div>
);

export const HouseResults = (props: { surveyId: string }) => {
  const router = useRouter();
  const { user } = useUser();
  const isAdmin = user.data?.roles.includes('admin') ?? false;
  const [results, setResults] = useState<HouseResultsDto | null>(null);

  const load = useCallback(async () => {
    setResults(await surveysApi(props.surveyId).results.$get().catch(() => null));
  }, [props.surveyId]);
  useEffect(() => void load(), [load]);

  const approve = (id: string): void => void surveysApi(id).approve.$post().then(load);
  const confirm = (id: string): void => void surveysApi(id).confirm.$post().then(load);
  const chooseOfficial = (officialSurveyId: DtoId['survey']): void => {
    if (results === null) return;
    void surveysApi(results.first.id).official.$post({ body: { officialSurveyId } }).then(load);
  };
  const exportPdf = (): void =>
    void surveysApi(props.surveyId).pdf.$get().then((t) => window.open(t.url, '_blank'));
  const exportCsv = (): void =>
    void apiClient.private.surveys.export.csv.$get({ query: {} }).then((t) => window.open(t.url, '_blank'));
  const startSecond = (): void => {
    if (results === null) return;
    router.push(`${pagesPath.surveys.new.$url().path}?type=second&parentId=${results.first.id}`);
  };

  if (results === null) return <p style={{ padding: 16 }}>読み込み中…</p>;

  const officialId = results.first.officialSurveyId;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <h1>{results.first.address}</h1>
      <SurveyCard
        survey={results.first}
        isAdmin={isAdmin}
        isOfficial={officialId === results.first.id}
        onApprove={() => approve(results.first.id)}
        onConfirm={() => confirm(results.first.id)}
        onChooseOfficial={() => chooseOfficial(results.first.id)}
      />
      {results.seconds.map((second) => (
        <SurveyCard
          key={second.id}
          survey={second}
          isAdmin={isAdmin}
          isOfficial={officialId === second.id}
          onApprove={() => approve(second.id)}
          onConfirm={() => confirm(second.id)}
          onChooseOfficial={() => chooseOfficial(second.id)}
        />
      ))}
      <ResultActions
        isAdmin={isAdmin}
        onSecond={startSecond}
        onPdf={exportPdf}
        onCsv={exportCsv}
        onBack={() => router.push(pagesPath.$url().path)}
      />
    </div>
  );
};
