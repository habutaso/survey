'use client';

import type { DtoId } from 'common/types/brandedId';
import { Loading } from 'components/loading/Loading';
import { useLocalDraft, type LocalSurveyType } from 'features/localFirst';
import { SurveyWizard } from 'features/survey/components/SurveyWizard';
import { PageLayout } from 'layouts/PageLayout';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { pagesPath } from 'utils/$path';

export default function NewSurveyPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { create } = useLocalDraft();
  const [draftId, setDraftId] = useState<string | null>(params.get('draftId'));

  const surveyType: LocalSurveyType = params.get('type') === 'second' ? 'second' : 'first';
  const parentId = params.get('parentId');

  useEffect(() => {
    if (draftId !== null) return;
    const parent = parentId === null ? undefined : (parentId as DtoId['survey']);
    void create(surveyType, parent).then(setDraftId);
  }, [draftId, create, surveyType, parentId]);

  return (
    <PageLayout
      render={() =>
        draftId === null ? (
          <Loading visible />
        ) : (
          <SurveyWizard draftId={draftId} onSubmitted={() => router.push(pagesPath.$url().path)} />
        )
      }
    />
  );
}
