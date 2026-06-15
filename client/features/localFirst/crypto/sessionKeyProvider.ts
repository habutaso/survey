import { fetchAuthSession } from 'aws-amplify/auth';

// 暗号鍵の key material をセッションから取得するポート（Q2=A）。
// 契約: セッション有効中は安定値を返し、ログアウト後は取得不能（reject）。
// → 再読込後はセッション有効中に再導出可能、ログアウトで導出不能＝実質消去（FR-18 と SECURITY-01 §4.3 を両立）。
export type SessionKeyProvider = { getKeyMaterial: () => Promise<ArrayBuffer> };

// 既定実装: Cognito セッションの idToken 由来のバイト列を key material とする。
// 注意: トークンは更新され得るため、導出済み CryptoKey は store がセッション中メモリ保持する
//（rotation の影響を受けない）。本アダプタは coverage 対象外（amplify 結合）。
export const amplifySessionKeyProvider: SessionKeyProvider = {
  getKeyMaterial: async () => {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (idToken === undefined) throw new Error('no-session');
    return new TextEncoder().encode(idToken).buffer;
  },
};
