// 数値補助（純粋・決定論, Q8=A / BR-22・BR-33）。

// [0,100] にクランプ。
export const clampRatio = (value: number): number => Math.min(100, Math.max(0, value));

// 小数第1位四捨五入（Q8=A）。
export const roundRatio = (value: number): number => Math.round(value * 10) / 10;
