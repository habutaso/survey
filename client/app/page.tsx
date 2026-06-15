'use client';

import { SurveyList } from 'features/survey/components/SurveyList';
import { PageLayout } from 'layouts/PageLayout';

export default function Home() {
  return <PageLayout render={() => <SurveyList />} />;
}
