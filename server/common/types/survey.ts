import type { SURVEY_STATUS_LIST, SURVEY_TYPE_LIST, STRUCTURE_TYPE_LIST } from 'common/constants';
import type { DtoId } from './brandedId';

// enum 型。値の真実の源は common/constants の各リスト（U2 / FR-04・FR-06・Q11=A）。
export type SurveyType = (typeof SURVEY_TYPE_LIST)[number];
export type SurveyStatus = (typeof SURVEY_STATUS_LIST)[number];
export type StructureType = (typeof STRUCTURE_TYPE_LIST)[number];

// 計算根拠等の JSON 値（assessmentBasis 等）。
export type Json = Record<string, unknown>;

// 値オブジェクト群（business-rules §5）。

// 階按分（FR-28 / US-404）。ratio の総和=100（BR-20）。
export type FloorRatio = { floor: number; ratio: number };

// 部位別損傷率（FR-23 / US-602/603）。正準部位キーは U3c マスタで確定。
export type PartDamage = { part: string; damageRatio: number };

// 外力・流失等フラグ（第1次, FR-20 / US-301）。
export type ExternalForceFlags = {
  houseWashedAway: boolean;
  groundScour: boolean;
  foundationWashout: boolean;
  fullCeilingInundation: boolean;
};

// 判定結果の保存契約（assessmentPort 出力 / 永続化境界, Q5・Q6=A）。
// 緩い契約: damageLevel=string（DB は String カラム）/ basis=Json（JSONB）。
// 正準（厳密）型は U3c の common/types/assessment.ts AssessmentResult（damageLevel: DamageLevel /
// basis: AssessmentBasis）。正準型は本緩い型へ構造的に代入可能（DamageLevel ⊆ string, AssessmentBasis ⊆ Json）。
// U3a/U3b は正準結果を算出し本契約へ widen して注入する（assessmentPort の signature は不変）。
export type AssessmentResult = {
  damageRatio: number;
  damageLevel: string;
  basis: Json;
};

// 第1次入力データ実体（FirstSurvey / surveyType=first）。
export type FirstSurveyData = {
  externalForceFlags: ExternalForceFlags;
  tiltRatio: number | null;
  inundationDepthCm: number | null;
  floorApportionment: FloorRatio[] | null;
};

// 第2次入力データ実体（SecondSurvey / surveyType=second）。
export type SecondSurveyData = {
  partDamages: PartDamage[];
  floorApportionment: FloorRatio[] | null;
};

// 非 PII 共通フィールド（一覧 DTO・詳細 DTO・エンティティで共有）。
export type SurveyCommon = {
  surveyType: SurveyType;
  parentSurveyId: DtoId['survey'] | null;
  status: SurveyStatus;
  // 家屋識別情報（Q10=A / 非 PII）。
  address: string;
  houseNumber: string;
  structureType: StructureType;
  buildingName: string | null;
  floors: number | null;
  // GPS（Q12=A / 任意）。
  latitude: number | null;
  longitude: number | null;
  // 判定結果（提出時にサーバ再計算で設定, Q5・Q6=A）。
  damageRatio: number | null;
  damageLevel: string | null;
  assessmentBasis: Json | null;
  // 正式判定（第1次のみ, Q14=A）。
  officialSurveyId: DtoId['survey'] | null;
  officialChosenBy: DtoId['user'] | null;
  officialChosenAt: number | null;
  // 実施者・日時（監査・履歴, NFR-08）。
  createdBy: DtoId['user'];
  createdTime: number;
  submittedAt: number | null;
  approvedBy: DtoId['user'] | null;
  approvedAt: number | null;
  confirmedBy: DtoId['user'] | null;
  confirmedAt: number | null;
  // 区分従属データ（一方のみ非 null, INV-4）。
  first: FirstSurveyData | null;
  second: SecondSurveyData | null;
};

// 被災者 PII（埋め込み, Q7=A）。詳細 DTO・エンティティのみ保持。一覧 DTO には含めない（BR-13 / INV-5）。
export type SurveyPii = {
  victimName: string | null;
  victimContact: string | null;
  victimAddress: string | null;
};

// 集約の全フィールド（PII 含む）。エンティティの基底。
export type SurveyBase = SurveyCommon & SurveyPii;

// 一覧・低権限用 DTO（PII 除外, BR-13 / INV-5）。
export type SurveyDto = SurveyCommon & { id: DtoId['survey'] };

// 詳細用 DTO（PII 含む, 調査員/管理者のみ）。
export type SurveyDetailDto = SurveyBase & { id: DtoId['survey'] };

// 画像メタ（実体保存は photoPort=U4。U2 は素通し）。
export type PhotoMeta = {
  fileName: string;
  contentType: string;
};

// 提出時一括同期ペイロード（US-207 / FR-18・19）。クライアントが IndexedDB から一括送信。
export type SubmissionPayload = {
  survey: {
    id: DtoId['survey'];
    surveyType: SurveyType;
    parentSurveyId?: DtoId['survey'];
    address: string;
    houseNumber: string;
    structureType: StructureType;
    buildingName?: string;
    floors?: number;
    victimName?: string;
    victimContact?: string;
    victimAddress?: string;
    latitude?: number;
    longitude?: number;
  };
  firstSurvey?: {
    externalForceFlags: ExternalForceFlags;
    tiltRatio?: number;
    inundationDepthCm?: number;
    floorApportionment?: FloorRatio[];
  };
  secondSurvey?: {
    partDamages: PartDamage[];
    floorApportionment?: FloorRatio[];
  };
  photos?: PhotoMeta[];
};

// 第1次/第2次の結果併記（US-605）。
export type HouseResultsDto = {
  first: SurveyDto;
  seconds: SurveyDto[];
};