import { requireJwtSecret } from './jwt-secrets';

describe('requireJwtSecret', () => {
  it.each([undefined, null, '', '   '])('refuse un secret absent (%p)', (value) => {
    expect(() => requireJwtSecret('JWT_SECRET', value)).toThrow('JWT_SECRET manquant');
  });

  it('retourne le secret tel quel, sans repli', () => {
    const secret = 'a'.repeat(64);
    expect(requireJwtSecret('JWT_REFRESH_SECRET', secret)).toBe(secret);
  });

  it('accepte un secret court (avertissement seulement, pas de coupure de prod)', () => {
    expect(requireJwtSecret('JWT_SECRET', 'court')).toBe('court');
  });
});
