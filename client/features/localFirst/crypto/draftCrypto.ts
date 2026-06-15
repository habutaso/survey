// ローカル保持データの暗号ラッパ（U-Cross BR-11 / SECURITY-01）。
// Web Crypto AES-GCM 256・レコード毎ランダム 12B IV。鍵はセッション派生・メモリのみ（store が保持）。

// 暗号化封筒。drafts/photos の値として保存される（iv はレコード毎ランダム）。
export type EncryptedRecord = { v: 1; iv: Uint8Array; ciphertext: ArrayBuffer };

const KEY_INFO = new TextEncoder().encode('survey-local-draft-key-v1');
const IV_BYTES = 12;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// セッション由来の key material と永続 salt から AES-GCM 256 鍵を HKDF 導出する。
// 返す CryptoKey は extractable=false（メモリのみ・取り出し不可, BR-U6f-2）。
export const deriveKey = async (keyMaterial: ArrayBuffer, salt: Uint8Array): Promise<CryptoKey> => {
  const base = await crypto.subtle.importKey('raw', keyMaterial, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: KEY_INFO },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

export const encryptBytes = async (key: CryptoKey, data: BufferSource): Promise<EncryptedRecord> => {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { v: 1, iv, ciphertext };
};

export const decryptBytes = (key: CryptoKey, record: EncryptedRecord): Promise<ArrayBuffer> =>
  crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv }, key, record.ciphertext);

export const encryptJson = (key: CryptoKey, value: unknown): Promise<EncryptedRecord> =>
  encryptBytes(key, textEncoder.encode(JSON.stringify(value)));

export const decryptJson = async <T>(key: CryptoKey, record: EncryptedRecord): Promise<T> =>
  JSON.parse(textDecoder.decode(await decryptBytes(key, record))) as T;

export const encryptBlob = async (key: CryptoKey, blob: Blob): Promise<EncryptedRecord> =>
  encryptBytes(key, await blob.arrayBuffer());

export const decryptBlob = async (
  key: CryptoKey,
  record: EncryptedRecord,
  contentType: string,
): Promise<Blob> => new Blob([await decryptBytes(key, record)], { type: contentType });
