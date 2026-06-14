import { DEFAULT_STRING_MAX } from 'common/constants';
import { z } from 'zod';

// 横断の共通バリデータ（US-801 / SECURITY-05）。ドメイン固有値は各ユニットが本プリミティブを援用して定義する。

// 損傷率・損害割合などの百分率（0–100）。
export const percentage = z.number().min(0).max(100);

// 文字列の既定最大長を適用するヘルパー（無制限長の回避）。
export const boundedString = (max: number = DEFAULT_STRING_MAX): z.ZodString => z.string().max(max);

// 数値範囲ヘルパー（浸水深など、min/max はドメイン側で指定）。
export const numberInRange = (min: number, max: number): z.ZodNumber =>
  z.number().min(min).max(max);

// epoch ミリ秒（非負整数）。
export const epochMs = z.number().int().nonnegative();
