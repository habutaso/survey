import { ID_NAME_LIST } from 'common/constants';
import type { DtoId, EntityId, IdName, MaybeId } from 'common/types/brandedId';
import { z } from 'zod';

type BrandedIdMap = {
  [Name in IdName]: {
    entity: z.ZodType<EntityId[Name]>;
    dto: z.ZodType<DtoId[Name]>;
    maybe: z.ZodType<MaybeId[Name]>;
  };
};

// ブランド型は型レベルのみの区別で、実行時バリデータは共通の z.string()。
// Object.fromEntries + キャストで構築し、ID_NAME_LIST の要素数に依存せず
// （単一要素でも）computed-key の厳格チェックを回避する。
export const brandedId = Object.fromEntries(
  ID_NAME_LIST.map((name) => [name, { entity: z.string(), dto: z.string(), maybe: z.string() }]),
) as unknown as BrandedIdMap;
