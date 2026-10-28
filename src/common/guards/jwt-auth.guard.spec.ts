import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';

function context(type: 'http' | 'ws', request: Record<string, unknown> = {}): ExecutionContext {
  return {
    getType: () => type,
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard (garde global)', () => {
  const passportCanActivate = jest
    .spyOn(AuthGuard('jwt').prototype, 'canActivate')
    .mockReturnValue(false);

  afterEach(() => passportCanActivate.mockClear());

  const guard = (isPublic: boolean) =>
    new JwtAuthGuard({ getAllAndOverride: () => isPublic } as unknown as Reflector);

  it('exige le JWT sur une route sans @Public()', () => {
    expect(guard(false).canActivate(context('http'))).toBe(false);
    expect(passportCanActivate).toHaveBeenCalledTimes(1);
  });

  it('laisse passer une route @Public() sans vérifier de jeton', () => {
    expect(guard(true).canActivate(context('http'))).toBe(true);
    expect(passportCanActivate).not.toHaveBeenCalled();
  });

  it('ne revalide pas une requête déjà authentifiée', () => {
    expect(guard(false).canActivate(context('http', { user: { _id: 'u1' } }))).toBe(true);
    expect(passportCanActivate).not.toHaveBeenCalled();
  });

  it('ignore les contextes WebSocket (handshake authentifié par la gateway)', () => {
    expect(guard(false).canActivate(context('ws'))).toBe(true);
    expect(passportCanActivate).not.toHaveBeenCalled();
  });
});
