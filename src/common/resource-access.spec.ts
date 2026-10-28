import { ForbiddenException } from '@nestjs/common';
import { Role } from './enums/role.enum';
import { assertSelfOrPrivileged } from './resource-access';

describe('assertSelfOrPrivileged', () => {
  const user = { _id: 'u1', role: Role.USER };

  it("laisse passer l'utilisateur sur ses propres données", () => {
    expect(() => assertSelfOrPrivileged(user, 'u1')).not.toThrow();
  });

  it("refuse l'accès aux données d'un autre utilisateur", () => {
    expect(() => assertSelfOrPrivileged(user, 'u2')).toThrow(ForbiddenException);
  });

  it('refuse un consultant sur un autre utilisateur', () => {
    expect(() => assertSelfOrPrivileged({ _id: 'c1', role: Role.CONSULTANT }, 'u2')).toThrow(ForbiddenException);
  });

  it('laisse passer ADMIN et SUPER_ADMIN', () => {
    expect(() => assertSelfOrPrivileged({ _id: 'a1', role: Role.ADMIN }, 'u2')).not.toThrow();
    expect(() => assertSelfOrPrivileged({ _id: 's1', role: Role.SUPER_ADMIN }, 'u2')).not.toThrow();
  });

  it('refuse sans utilisateur ou sans userId', () => {
    expect(() => assertSelfOrPrivileged(undefined, 'u1')).toThrow(ForbiddenException);
    expect(() => assertSelfOrPrivileged(user, undefined)).toThrow(ForbiddenException);
  });
});
