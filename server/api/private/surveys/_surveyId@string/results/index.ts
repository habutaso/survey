import type { DefineMethods } from 'aspida';
import type { HouseResultsDto } from 'common/types/survey';

// 第1次＋第2次群の結果併記（US-605 / FR-09）。PII 除外。
export type Methods = DefineMethods<{
  get: {
    resBody: HouseResultsDto;
  };
}>;