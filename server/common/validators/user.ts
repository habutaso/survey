import { z } from 'zod';
import { roleValidator } from './role';

// ユーザー関連の入力バリデータ。
// assignRolesBody: ロール割当（roles 配列を置換）。空配列も許可（無権限化）。
// 重複排除はハンドラ/メソッド側で実施する（BR-6 置換セマンティクス）。
export const userValidator = {
  assignRolesBody: z.object({ roles: z.array(roleValidator) }),
};
