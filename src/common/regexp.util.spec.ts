import { escapeRegExp, createSafeRegExp } from './regexp.util';

describe('escapeRegExp', () => {
  it('should return empty string for null, undefined or non-string input', () => {
    expect(escapeRegExp(null as any)).toBe('');
    expect(escapeRegExp(undefined as any)).toBe('');
    expect(escapeRegExp(123 as any)).toBe('');
  });

  it('should return unchanged text when no special regex characters are present', () => {
    expect(escapeRegExp('hello world')).toBe('hello world');
    expect(escapeRegExp('JohnDoe123')).toBe('JohnDoe123');
  });

  it('should escape regex metacharacters properly', () => {
    const specialChars = '.*+?^${}()|[]\\';
    const escaped = escapeRegExp(specialChars);
    expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  it('should prevent ReDoS payload patterns from being interpreted as regular expressions', () => {
    const malicious = '(a+)+$';
    const escaped = escapeRegExp(malicious);
    expect(escaped).toBe('\\(a\\+\\)\\+\\$');
    const regex = new RegExp(escaped);
    expect(regex.test('(a+)+$')).toBe(true);
    expect(regex.test('aaaaaaaaaaaaaaaaaaaaaaaaaa!')).toBe(false);
  });

  it('should create safe RegExp without throwing syntax errors on unmatched parenthesis or brackets', () => {
    expect(() => createSafeRegExp('(unmatched')).not.toThrow();
    expect(() => createSafeRegExp('[unclosed')).not.toThrow();
    const regex = createSafeRegExp('[test]', 'i');
    expect(regex.test('[test]')).toBe(true);
    expect(regex.test('t')).toBe(false);
  });
});
