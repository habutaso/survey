import { boundedString } from 'common/validators/common';
import { z } from 'zod';
import { brandedId } from './brandedId';

// 画像 MIME 限定（BR-P15）。image/* のみ許可。
const imageContentType = boundedString()
  .min(1)
  .regex(/^image\//, '画像ファイルのみアップロードできます');

// 任意ラベル（部位/ステップ, Q-U4-3=C）。値ありなら境界付き文字列、全体写真等は null を明示。
const nullableLabel = boundedString().min(1).nullable();

// 画像メタ（提出ペイロード内の各写真, BR-P11/P15）。
export const photoMeta = z.object({
  fileName: boundedString().min(1),
  contentType: imageContentType,
  part: nullableLabel,
  step: nullableLabel,
});

export const photoValidator = {
  // アップロード確認（pending→uploaded, BR-P8）。対象写真 ID 群。
  confirmBody: z.object({ photoIds: z.array(brandedId.photo.dto).min(1) }),
};
