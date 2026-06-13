import type { ROLE_LIST } from 'common/constants';

// ロール型。値は common/constants の ROLE_LIST を真実の源とする（surveyor/admin/viewer）。
export type Role = (typeof ROLE_LIST)[number];
