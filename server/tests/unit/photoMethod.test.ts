import type { DtoId } from 'common/types/brandedId';
import type { PhotoDto, PhotoMeta } from 'common/types/photo';
import { photoMethod } from 'domain/photo/model/photoMethod';
import { brandedId } from 'common/validators/brandedId';
import { NotFoundError } from 'service/customAssert';
import { ulid } from 'ulid';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

const surveyId = brandedId.survey.dto.parse(ulid());
const userId = brandedId.user.dto.parse(ulid());
const meta: PhotoMeta = { fileName: 'roof.jpg', contentType: 'image/jpeg', part: 'roof', step: 'before' };

const dtoId = (): DtoId['photo'] => brandedId.photo.dto.parse(ulid());

const photo = (over: Partial<PhotoDto> = {}): PhotoDto => ({
  id: dtoId(),
  surveyId,
  part: null,
  step: null,
  fileName: 'p.jpg',
  contentType: 'image/jpeg',
  s3Key: 'surveys/x/y',
  status: 'pending',
  createdBy: userId,
  createdAt: 0,
  uploadedAt: null,
  ...over,
});

describe('photoMethod.buildKey', () => {
  test('決定論的キー surveys/{surveyId}/{photoId}（BR-P5/INV-P2）', () => {
    expect(photoMethod.buildKey('s1', 'p1')).toBe('surveys/s1/p1');
  });
});

describe('photoMethod.create', () => {
  test('pending・s3Key 採番・uploadedAt null（BR-P7）', () => {
    const id = brandedId.photo.entity.parse(ulid());
    const e = photoMethod.create(id, surveyId, meta, userId, 1234);

    expect(e.status).toBe('pending');
    expect(e.uploadedAt).toBeNull();
    expect(e.s3Key).toBe(`surveys/${surveyId}/${id}`);
    expect(e.part).toBe('roof');
    expect(e.step).toBe('before');
    expect(e.createdAt).toBe(1234);
  });
});

describe('photoMethod.markUploaded（冪等 / INV-P1）', () => {
  test('pending → uploaded・uploadedAt 付与', () => {
    const result = photoMethod.markUploaded(photo({ status: 'pending' }), 999);

    expect(result.status).toBe('uploaded');
    expect(result.uploadedAt).toBe(999);
  });

  test('uploaded は no-op（同一参照を返す）', () => {
    const original = photo({ status: 'uploaded', uploadedAt: 5 });

    expect(photoMethod.markUploaded(original, 999)).toBe(original);
  });
});

describe('photoMethod.selectViewable（INV-P3 / BR-P9）', () => {
  test('uploaded のみ抽出', () => {
    const list = [photo({ status: 'pending' }), photo({ status: 'uploaded' })];

    expect(photoMethod.selectViewable(list).map((p) => p.status)).toEqual(['uploaded']);
  });
});

describe('photoMethod.assertAllFound（BR-P10）', () => {
  test('全て見つかれば通過', () => {
    const p = photo();

    expect(() => photoMethod.assertAllFound([p], [p.id])).not.toThrow();
  });

  test('不在 ID があれば NotFoundError', () => {
    expect(() => photoMethod.assertAllFound([], [dtoId()])).toThrow(NotFoundError);
  });
});

describe('PBT: 写真ライフサイクル不変条件', () => {
  const statusArb = fc.constantFrom<'pending' | 'uploaded'>('pending', 'uploaded');
  const photoArb = statusArb.map((status) =>
    photo({ status, uploadedAt: status === 'uploaded' ? 1 : null }),
  );
  const allUploaded = (list: PhotoDto[]): boolean => list.every((p) => p.status === 'uploaded');

  test('INV-P3: selectViewable は pending を一切含まない', () => {
    fc.assert(
      fc.property(fc.array(photoArb), (list) => {
        expect(allUploaded(photoMethod.selectViewable(list))).toBe(true);
      }),
    );
  });

  test('INV-P1: markUploaded 後は status=uploaded ⇔ uploadedAt!==null', () => {
    fc.assert(
      fc.property(photoArb, fc.integer({ min: 1 }), (p, at) => {
        const result = photoMethod.markUploaded(p, at);

        expect(result.status === 'uploaded').toBe(result.uploadedAt !== null);
      }),
    );
  });

  test('冪等: markUploaded を二度適用しても結果は不変', () => {
    fc.assert(
      fc.property(photoArb, fc.integer({ min: 1 }), (p, at) => {
        const once = photoMethod.markUploaded(p, at);

        expect(photoMethod.markUploaded(once, at + 100)).toEqual(once);
      }),
    );
  });
});
