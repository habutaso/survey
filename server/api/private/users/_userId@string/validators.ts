import { z } from 'zod';
import { defineValidators } from './$relay';

// パスパラメータ検証（SECURITY-05）。userId は文字列。DtoId への brand 化は controller で行う。
export default defineValidators(() => ({
  params: z.object({ userId: z.string() }),
}));
