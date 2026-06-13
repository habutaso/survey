import { ROLE_LIST } from 'common/constants';
import { z } from 'zod';

// ロール値のバリデータ（SECURITY-05: 入力検証）。ROLE_LIST を真実の源とする。
export const roleValidator = z.enum(ROLE_LIST);
