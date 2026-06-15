import type { EntityId } from 'common/types/brandedId';
import type { PhotoBase } from 'common/types/photo';

// 写真エンティティ（EntityId）。surveyId は所属調査への参照（DtoId）。
export type PhotoEntity = PhotoBase & { id: EntityId['photo'] };
