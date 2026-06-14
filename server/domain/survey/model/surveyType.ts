import type { EntityId } from 'common/types/brandedId';
import type { SurveyBase } from 'common/types/survey';

// 集約ルートのエンティティ（PII 含む, EntityId）。
// FirstSurvey/SecondSurvey は SurveyBase の first/second に内包し、surveyId を共有主キーとする
// （独立 ID は持たない, domain-entities §0/Q2=A）。
export type SurveyEntity = SurveyBase & { id: EntityId['survey'] };