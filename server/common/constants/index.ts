export const APP_NAME = 'CATAPULT';

// ドメイン ID 名の一覧。新ドメインを追加するユニットがここへ ID 名を追記する
// （例: U2 で 'survey', 'firstSurvey', 'secondSurvey' / U4 で 'photo' など）。
// ID 値は ULID（`ulid` パッケージ）で採番し、brandedId が本リストを駆動して型/バリデータを自動生成する。
export const ID_NAME_LIST = ['user'] as const;

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
