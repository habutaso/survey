import type { Prisma } from '@prisma/client';
import type { PhotoMeta } from 'common/types/survey';
import { depend } from 'velona';

// 永続化済み画像参照（U4 で S3 キー等が入る）。U2 は素通し参照のみ。
export type SavedPhotoRef = { fileName: string };

// 画像永続化ポート（DI 境界 / Q4=A, NFR-09）。
// U2 は no-op スタブ（メタ参照を素通し）。U4 が S3 保存実装を `depend` の dependency 差替で注入する。
export const photoPort = {
  persist: depend(
    {
      store: (_surveyId: string, metas: PhotoMeta[]): SavedPhotoRef[] =>
        metas.map((meta) => ({ fileName: meta.fileName })),
    },
    (
      { store },
      _tx: Prisma.TransactionClient,
      surveyId: string,
      metas: PhotoMeta[],
    ): SavedPhotoRef[] => store(surveyId, metas),
  ),
};