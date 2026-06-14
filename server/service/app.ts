import cookie from '@fastify/cookie';
import fastifyEtag from '@fastify/etag';
import helmet from '@fastify/helmet';
import fastifyHttpProxy from '@fastify/http-proxy';
import type { TokenOrHeader } from '@fastify/jwt';
import fastifyJwt from '@fastify/jwt';
import assert from 'assert';
import { IS_PROD } from 'common/constants';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import Fastify from 'fastify';
import buildGetJwks from 'get-jwks';
import type { DtoId } from 'common/types/brandedId';
import { auditUseCase } from 'domain/audit/auditUseCase';
import server from '../$server';
import { COOKIE_NAMES, JWT_PROP_NAME } from './constants';
import { resolveBody, resolveHttpStatus } from './errorHandler';
import { prismaClient } from './prismaClient';
import {
  API_BASE_PATH,
  COGNITO_POOL_ENDPOINT,
  COGNITO_USER_POOL_CLIENT_ID,
  COGNITO_USER_POOL_ID,
  SERVER_PORT,
} from './envValues';

export const init = (): FastifyInstance => {
  const fastify = Fastify();
  const getJwks = buildGetJwks();

  // API はJSON応答。CSP は HTML 配信側（Next.js, U6u）で付与する役割分担（Q9=A）。
  fastify.register(helmet, {
    contentSecurityPolicy: false,
    hsts: { maxAge: 15552000, includeSubDomains: true },
    frameguard: { action: 'deny' },
    noSniff: true,
  });
  fastify.register(fastifyEtag, { weak: true });
  fastify.register(cookie);
  fastify.register(fastifyJwt, {
    decoratorName: JWT_PROP_NAME,
    cookie: { cookieName: COOKIE_NAMES.idToken, signed: false },
    decode: { complete: true },
    secret: (_: FastifyRequest, token: TokenOrHeader) => {
      assert('header' in token);
      assert((token.payload as { aud: string }).aud === COGNITO_USER_POOL_CLIENT_ID);

      const domain = `${COGNITO_POOL_ENDPOINT}/${COGNITO_USER_POOL_ID}`;

      return getJwks.getPublicKey({
        kid: (token.header as { kid: string }).kid,
        domain,
        alg: (token.header as { alg: string }).alg,
      });
    },
  });

  if (IS_PROD) {
    fastify.register(fastifyHttpProxy, {
      upstream: `http://localhost:${SERVER_PORT + 1}`,
      replyOptions: {
        rewriteHeaders: (headers) => ({ ...headers, 'content-security-policy': undefined }),
      },
    });
  }

  // 型ベースのエラー→HTTP マッピング（BR-7, fail closed）。認可失敗(403)は監査記録する。
  fastify.setErrorHandler(async (err, req, reply) => {
    const status = resolveHttpStatus(err);

    if (status >= 500) console.error(new Date(), (err as Error).stack);

    if (status === 403) {
      // best-effort 監査（記録失敗は本処理を妨げない）。
      await auditUseCase
        .record(prismaClient, {
          actorUserId: (req as { user?: { id: DtoId['user'] } }).user?.id ?? null,
          action: 'authz.failure',
          targetType: 'authz',
          targetId: null,
          outcome: 'failure',
          summary: `認可失敗: ${req.method} ${req.routeOptions.url ?? req.url}`,
        })
        .catch(() => undefined);
    }

    return reply.status(status).send(resolveBody(err, status));
  });

  server(fastify, { basePath: API_BASE_PATH });

  return fastify;
};
