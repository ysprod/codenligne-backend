import { ConfigService } from '@nestjs/config';
import {
  isPrivateHostname,
  resolveApiBaseUrl,
  resolveFrontendUrl,
  toOrigin,
} from './request-origin';

function configWith(env: Record<string, string> = {}): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

const PROD_ENV = {
  BASE_URL: 'https://monetoile.org',
  FRONTEND_URL: 'https://monetoile.org',
};

describe('request-origin', () => {
  describe('isPrivateHostname', () => {
    it.each(['localhost', '127.0.0.1', '::1', 'macbook.local', '192.168.1.20', '10.0.0.5', '172.16.3.4'])(
      '%s est privé',
      (host) => expect(isPrivateHostname(host)).toBe(true),
    );

    it.each(['monetoile.org', 'evil.com', '8.8.8.8', '172.32.0.1'])('%s est public', (host) =>
      expect(isPrivateHostname(host)).toBe(false),
    );
  });

  describe('toOrigin', () => {
    it('normalise une URL en origine', () => {
      expect(toOrigin('https://monetoile.org/star/x?a=1')).toBe('https://monetoile.org');
      expect(toOrigin('http://192.168.1.20:3000')).toBe('http://192.168.1.20:3000');
    });

    it('rejette ce qui n’est pas une URL http(s)', () => {
      expect(toOrigin('javascript:alert(1)')).toBeUndefined();
      expect(toOrigin('')).toBeUndefined();
    });
  });

  describe('resolveApiBaseUrl', () => {
    it('utilise le host local servi (dev sur IP de LAN)', () => {
      const req = { headers: { host: '192.168.1.20:3001' }, protocol: 'http' };
      expect(resolveApiBaseUrl(req, configWith(PROD_ENV))).toBe('http://192.168.1.20:3001');
    });

    it('respecte les en-têtes du proxy (Caddy) pour le schéma et l’hôte', () => {
      const req = {
        headers: {
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'monetoile.org',
          host: 'localhost:3001',
        },
      };
      expect(resolveApiBaseUrl(req, configWith(PROD_ENV))).toBe('https://monetoile.org');
    });

    it('ignore un Host injecté et retombe sur BASE_URL', () => {
      const req = { headers: { host: 'evil.example.com' }, protocol: 'https' };
      expect(resolveApiBaseUrl(req, configWith(PROD_ENV))).toBe('https://monetoile.org');
    });

    it('accepte un hôte public explicitement autorisé', () => {
      const req = { headers: { host: 'api.preprod.example.com' }, protocol: 'https' };
      const config = configWith({ ...PROD_ENV, PUBLIC_URL_ALLOWLIST: 'https://api.preprod.example.com' });
      expect(resolveApiBaseUrl(req, config)).toBe('https://api.preprod.example.com');
    });

    it('ne garde que la première valeur d’un en-tête chaîné par les proxies', () => {
      const req = { headers: { 'x-forwarded-host': 'monetoile.org, evil.com', 'x-forwarded-proto': 'https' } };
      expect(resolveApiBaseUrl(req, configWith(PROD_ENV))).toBe('https://monetoile.org');
    });

    it('refuse un hôte privé EN PRODUCTION (X-Forwarded-Host injecté)', () => {
      const config = configWith({ ...PROD_ENV, NODE_ENV: 'production' });
      const req = { headers: { 'x-forwarded-host': '127.0.0.1' }, protocol: 'http' };
      expect(resolveApiBaseUrl(req, config)).toBe('https://monetoile.org');
    });

    it('accepte toujours l’hôte de production légitime', () => {
      const config = configWith({ ...PROD_ENV, NODE_ENV: 'production' });
      const req = { headers: { 'x-forwarded-host': 'monetoile.org', 'x-forwarded-proto': 'https' } };
      expect(resolveApiBaseUrl(req, config)).toBe('https://monetoile.org');
    });

    it('retombe sur le défaut local sans requête ni env', () => {
      expect(resolveApiBaseUrl(undefined, configWith())).toBe('http://localhost:3001');
    });
  });

  describe('resolveFrontendUrl', () => {
    it('utilise l’Origin du front appelant (IP de LAN en dev)', () => {
      const req = { headers: { origin: 'http://192.168.1.20:3000' } };
      expect(resolveFrontendUrl(req, configWith(PROD_ENV))).toBe('http://192.168.1.20:3000');
    });

    it('retombe sur le Referer si Origin est absent', () => {
      const req = { headers: { referer: 'http://localhost:3000/star/marcheoffrandes?x=1' } };
      expect(resolveFrontendUrl(req, configWith(PROD_ENV))).toBe('http://localhost:3000');
    });

    it('ignore une Origin publique non autorisée (pas de redirection vers un site tiers)', () => {
      const req = { headers: { origin: 'https://phishing.example.com' } };
      expect(resolveFrontendUrl(req, configWith(PROD_ENV))).toBe('https://monetoile.org');
    });

    it('accepte la variante www du domaine configuré', () => {
      const req = { headers: { origin: 'https://www.monetoile.org' } };
      expect(resolveFrontendUrl(req, configWith(PROD_ENV))).toBe('https://www.monetoile.org');
    });

    it('retombe sur FRONTEND_URL sans en-tête exploitable', () => {
      expect(resolveFrontendUrl({ headers: {} }, configWith(PROD_ENV))).toBe('https://monetoile.org');
    });
  });
});
