import assert from 'assert';
import type { UserDto } from 'common/types/user';
import { auditUseCase } from 'domain/audit/auditUseCase';
import { userUseCase } from 'domain/user/userUseCase';
import { COOKIE_NAMES, type JWT_PROP_NAME } from 'service/constants';
import { prismaClient } from 'service/prismaClient';
import type { JwtUser } from 'service/types';
import { defineHooks } from './$relay';

export type AdditionalRequest = { [Key in typeof JWT_PROP_NAME]?: JwtUser } & {
  accessToken: string;
  user: UserDto;
};

export default defineHooks(() => ({
  onRequest: async (req, res) => {
    try {
      await req.jwtVerify({ onlyCookie: true });
    } catch (e) {
      // 認証失敗を監査記録（US-803 / SECURITY-13）。
      await auditUseCase.record(prismaClient, {
        actorUserId: null,
        action: 'auth.failure',
        targetType: 'auth',
        targetId: null,
        outcome: 'failure',
        summary: '認証失敗',
      });
      res.status(401).send((e as Error).message);
      return;
    }

    const accessToken = req.cookies[COOKIE_NAMES.accessToken];

    assert(accessToken);
    assert(req.jwtUser);

    req.accessToken = accessToken;
    req.user = await userUseCase.findOrCreateUser(req.jwtUser, accessToken);
  },
}));
