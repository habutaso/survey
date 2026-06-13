import type { DefineMethods } from 'aspida';
import type { Role } from 'common/types/role';
import type { UserDto } from 'common/types/user';

// ロール管理エンドポイント（FU-3.3）。admin 限定。roles 配列を置換するセマンティクス（BR-6）。
export type Methods = DefineMethods<{
  patch: {
    reqBody: { roles: Role[] };
    resBody: UserDto;
  };
}>;
