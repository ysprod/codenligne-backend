import { ForbiddenException } from '@nestjs/common';
import { assertCanSetCustomPermissions } from './custom-permissions';
import { Role } from './enums/role.enum';

describe('assertCanSetCustomPermissions', () => {
  it('laisse passer une requête sans customPermissions', () => {
    expect(() => assertCanSetCustomPermissions({ role: Role.ADMIN }, undefined)).not.toThrow();
  });

  it.each([Role.ADMIN, Role.CONSULTANT, Role.USER])('refuse à %s (même une liste vide)', (role) => {
    expect(() => assertCanSetCustomPermissions({ role }, ['manage:roles'])).toThrow(ForbiddenException);
    expect(() => assertCanSetCustomPermissions({ role }, [])).toThrow(ForbiddenException);
  });

  it('refuse sans acteur identifié', () => {
    expect(() => assertCanSetCustomPermissions(undefined, [])).toThrow(ForbiddenException);
  });

  it('autorise un SUPER_ADMIN', () => {
    expect(() => assertCanSetCustomPermissions({ role: Role.SUPER_ADMIN }, ['manage:roles'])).not.toThrow();
  });
});
