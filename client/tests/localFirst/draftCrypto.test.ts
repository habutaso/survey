import fc from 'fast-check';
import { expect, test } from 'vitest';
import {
  decryptBlob,
  decryptBytes,
  deriveKey,
  encryptBlob,
  encryptBytes,
  encryptJson,
  decryptJson,
} from 'features/localFirst/crypto/draftCrypto';

const getKey = (saltByte = 0): Promise<CryptoKey> =>
  deriveKey(new TextEncoder().encode('test-session-secret').buffer, new Uint8Array(16).fill(saltByte));

test('deriveKey returns a non-extractable AES-GCM 256 key', async () => {
  const key = await getKey();
  expect(key.type).toBe('secret');
  expect(key.extractable).toBe(false);
  expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
});

test('INV-U6f-1: encryptJson/decryptJson round-trips arbitrary JSON', async () => {
  const key = await getKey();
  await fc.assert(
    fc.asyncProperty(fc.jsonValue(), async (value) => {
      const back = await decryptJson(key, await encryptJson(key, value));
      expect(back).toStrictEqual(value);
    }),
    { numRuns: 50 },
  );
});

test('INV-U6f-8: encryptBlob/decryptBlob round-trips arbitrary bytes', async () => {
  const key = await getKey();
  await fc.assert(
    fc.asyncProperty(fc.uint8Array(), async (bytes) => {
      const blob = new Blob([bytes], { type: 'image/png' });
      const back = await decryptBlob(key, await encryptBlob(key, blob), 'image/png');
      expect(back.type).toBe('image/png');
      expect(new Uint8Array(await back.arrayBuffer())).toStrictEqual(bytes);
    }),
    { numRuns: 50 },
  );
});

test('INV-U6f-2: each encryption uses a fresh random 12-byte IV', async () => {
  const key = await getKey();
  const a = await encryptJson(key, { x: 1 });
  const b = await encryptJson(key, { x: 1 });
  expect(a.iv).toHaveLength(12);
  expect(Array.from(a.iv)).not.toStrictEqual(Array.from(b.iv));
});

test('encryptBytes/decryptBytes round-trips raw bytes', async () => {
  const key = await getKey();
  const data = new Uint8Array([1, 2, 3, 4]);
  const record = await encryptBytes(key, data);
  expect(new Uint8Array(await decryptBytes(key, record))).toStrictEqual(data);
});

test('decryption with a different key fails (tamper/loss safety)', async () => {
  const record = await encryptJson(await getKey(0), { secret: 'pii' });
  await expect(decryptJson(await getKey(9), record)).rejects.toThrow();
});
