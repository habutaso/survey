'use client';

import { HouseResults } from 'features/survey/components/HouseResults';
import { PageLayout } from 'layouts/PageLayout';
import { useParams } from 'next/navigation';

export default function SurveyDetailPage() {
  const params = useParams<{ surveyId: string }>();

  return <PageLayout render={() => <HouseResults surveyId={params.surveyId} />} />;
}
