import type { ConversionBand } from 'domain/assessment/types';
import { customAssert } from 'service/customAssert';

// 換算表から値に該当する帯の損害割合(%)を返す（FR-21・FR-22）。
// 表は lower 昇順・連続（先頭 lower=0）。非負値に対し「最初に upper が value 超（または null）の帯」が該当する。
// （lower 境界は表整合テストで検証）。value>=0 のため必ず該当する。
export const lookupBandRatio = (value: number, bands: ConversionBand[]): number => {
  const band = bands.find((b) => b.upper === null || value < b.upper);
  customAssert(band, 'conversion table must cover the input value');
  return band.damageRatio;
};
