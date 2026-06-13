import type { DtoId } from './brandedId';
import type { Role } from './role';

export type UserBase = {
  signInName: string;
  displayName: string;
  email: string;
  createdTime: number;
  photoUrl: string | undefined;
  roles: Role[];
};

export type UserDto = UserBase & { id: DtoId['user'] };
