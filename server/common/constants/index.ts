export const APP_NAME = 'CATAPULT';

// ドメイン ID 名の一覧。新ドメインを追加するユニットがここへ ID 名を追記する
// （例: U2 で 'survey', 'firstSurvey', 'secondSurvey' / U4 で 'photo' など）。
// ID 値は ULID（`ulid` パッケージ）で採番し、brandedId が本リストを駆動して型/バリデータを自動生成する。
export const ID_NAME_LIST = ['user', 'auditLog', 'survey', 'photo'] as const;

export const IS_PROD = process.env.NODE_ENV === 'production';

const listToDict = <T extends readonly [string, ...string[]]>(list: T): { [U in T[number]]: U } =>
  list.reduce((dict, type) => ({ ...dict, [type]: type }), {} as { [U in T[number]]: U });

export const ID_NAMES = listToDict(ID_NAME_LIST);

// ロール（権限）の一覧。DB を真実の源とし（Q1=B）、1 ユーザーが 0〜複数保有できる（Q3=B）。
// 認可は any-match（許可集合と user.roles の積集合が非空なら許可）、無ロール = 全拒否（Q4=B）。
export const ROLE_LIST = ['surveyor', 'admin', 'viewer'] as const;

export const ROLE_NAMES = listToDict(ROLE_LIST);

// 表示名（Q5=A: 英語 enum ＋ 日本語表示名マップ）。クライアント表示はこのマップを共通参照する。
export const ROLE_DISPLAY: Record<(typeof ROLE_LIST)[number], string> = {
  surveyor: '調査員',
  admin: '管理者',
  viewer: '閲覧者',
};

// 監査アクション（U-Cross）。横断基盤として最小集合を定義し、後続ユニットが値を追記してよい。
// DB は String カラムで保持し、アプリ層で本リスト（zod/TS union）により検証する。
export const AUDIT_ACTION_LIST = [
  'auth.login',
  'auth.failure',
  'authz.failure',
  'user.roles.change',
  'survey.submit',
  'survey.approve',
  'survey.confirm',
  'survey.reject',
  'survey.officialJudgment',
  'photo.uploadConfirmed',
  'export.pdf',
  'export.csv',
  'pii.change',
] as const;

// 監査結果。
export const AUDIT_OUTCOME_LIST = ['success', 'failure'] as const;

// 文字列入力の既定最大長（SECURITY-05 / 無制限長の回避）。
export const DEFAULT_STRING_MAX = 1000;

// 調査区分（U2 / Q11=A）。第1次/第2次。DB は String カラムで保持し、アプリ層で本リスト（zod/TS union）により検証する。
export const SURVEY_TYPE_LIST = ['first', 'second'] as const;

export const SURVEY_TYPE_NAMES = listToDict(SURVEY_TYPE_LIST);

export const SURVEY_TYPE_DISPLAY: Record<(typeof SURVEY_TYPE_LIST)[number], string> = {
  first: '第1次調査',
  second: '第2次調査',
};

// 調査状態（U2 / FR-04）。サーバ永続化の起点は submitted（draft はクライアント論理状態, Q1=A）。
// confirmed は終端・不変（FR-05 / BR-8）。
export const SURVEY_STATUS_LIST = ['draft', 'submitted', 'approved', 'confirmed'] as const;

export const SURVEY_STATUS_NAMES = listToDict(SURVEY_STATUS_LIST);

export const SURVEY_STATUS_DISPLAY: Record<(typeof SURVEY_STATUS_LIST)[number], string> = {
  draft: '下書き',
  submitted: '提出',
  approved: '承認',
  confirmed: '確定',
};

// 構造種別（U2 / Q11=A）。木造/非木造。
export const STRUCTURE_TYPE_LIST = ['wood', 'nonWood'] as const;

export const STRUCTURE_TYPE_NAMES = listToDict(STRUCTURE_TYPE_LIST);

export const STRUCTURE_TYPE_DISPLAY: Record<(typeof STRUCTURE_TYPE_LIST)[number], string> = {
  wood: '木造',
  nonWood: '非木造',
};

// 被害度区分（U3c / FR-24 / Q1・Q2=A）。損害割合(%)→6区分。配列順は被害度の重い順。
// 区間は下限包含・上限排他（閾値は domain/assessment/constants/damageLevelThresholds.ts）。
export const DAMAGE_LEVEL_LIST = [
  'totalCollapse',
  'largeScaleHalf',
  'mediumScaleHalf',
  'half',
  'quasiHalf',
  'partial',
] as const;

export const DAMAGE_LEVEL_NAMES = listToDict(DAMAGE_LEVEL_LIST);

// 表示名（Q2=A: 英語 enum ＋ 日本語表示名マップ）。
export const DAMAGE_LEVEL_DISPLAY: Record<(typeof DAMAGE_LEVEL_LIST)[number], string> = {
  totalCollapse: '全壊',
  largeScaleHalf: '大規模半壊',
  mediumScaleHalf: '中規模半壊',
  half: '半壊',
  quasiHalf: '準半壊',
  partial: '準半壊に至らない（一部損壊）',
};


// 写真アップロード状態（U4 / Q-U4-4=B）。pending=登録のみ、uploaded=アップロード確認済（閲覧可）。
// DB は String カラムで保持し、アプリ層で本リスト（zod/TS union）により検証する。
export const PHOTO_STATUS_LIST = ['pending', 'uploaded'] as const;

export const PHOTO_STATUS_NAMES = listToDict(PHOTO_STATUS_LIST);

// 一覧・検索のページング既定（U5 / Q-U5-4=A / NFR-03）。pageSize 上限で過大取得を防止。
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
