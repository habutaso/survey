// 指数バックオフ（Q6=A / BR-U6f-7）。base 1s・factor 2・cap 30s・jitter ±20%・最大 5 回。
const BASE_MS = 1000;
const FACTOR = 2;
const CAP_MS = 30000;
const JITTER = 0.2;
export const MAX_ATTEMPTS = 5;

// attempts 回目失敗後の次回遅延（ms）。rng は [0,1) を返す注入可能な乱数（テスト決定化）。
export const nextDelayMs = (attempts: number, rng: () => number = Math.random): number => {
  const raw = Math.min(CAP_MS, BASE_MS * FACTOR ** attempts);
  const jitterFactor = 1 + (rng() * 2 - 1) * JITTER;
  return Math.round(raw * jitterFactor);
};

// jitter を除いた基準遅延（単調増加・cap, INV-U6f-6 検証用）。
export const baseDelayMs = (attempts: number): number =>
  Math.min(CAP_MS, BASE_MS * FACTOR ** attempts);

export const shouldRetry = (attempts: number): boolean => attempts < MAX_ATTEMPTS;
