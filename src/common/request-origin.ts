import { ConfigService } from '@nestjs/config';

/**
 * Résolution des URLs publiques (callback passerelle, retour navigateur) à partir
 * de la requête entrante plutôt que d'une valeur figée dans l'environnement.
 *
 * Pourquoi : en dev comme en préprod, l'application est jointe tantôt par
 * `localhost`, tantôt par une IP de LAN, tantôt par un domaine de tunnel. Une URL
 * figée envoie la passerelle au mauvais endroit.
 *
 * Pourquoi ce n'est pas une simple lecture du header `Host` : `Host` et `Origin`
 * sont contrôlés par l'appelant. Les accepter aveuglément permettrait de faire
 * poster le callback (données de paiement) sur un serveur tiers, et de rediriger
 * le payeur vers un site arbitraire après paiement. La valeur dérivée n'est donc
 * retenue que si elle est **locale/privée hors production** ou **explicitement
 * autorisée** (`PUBLIC_URL_ALLOWLIST`, `BASE_URL`, `FRONTEND_URL`) ; sinon on
 * retombe sur l'env. En production, un `X-Forwarded-Host: 127.0.0.1` injecté ne
 * peut donc pas détourner l'URL de callback vers une adresse injoignable.
 */

/** Requête minimale (compatible Express) — évite de coupler ce helper à un framework */
export interface OriginRequestLike {
  headers?: Record<string, string | string[] | undefined>;
  protocol?: string;
  secure?: boolean;
}

function firstHeader(
  req: OriginRequestLike | undefined,
  name: string,
): string | undefined {
  const raw = req?.headers?.[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  // Un proxy peut chaîner les valeurs : "a.example.com, b.example.com"
  return String(value).split(',')[0].trim() || undefined;
}

/** Hôte local ou privé (RFC1918 / .local) : dérivation sans risque en dev */
export function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(host)) return true;
  if (host.endsWith('.local') || host.endsWith('.localhost')) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return false;
}

/** Normalise une URL en origine (`https://host[:port]`), ou undefined si invalide */
export function toOrigin(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

/** Origines explicitement autorisées : PUBLIC_URL_ALLOWLIST + BASE_URL + FRONTEND_URL */
export function getAllowedOrigins(configService: ConfigService): string[] {
  const raw = [
    ...String(configService.get<string>('PUBLIC_URL_ALLOWLIST') || '').split(','),
    configService.get<string>('BASE_URL'),
    configService.get<string>('FRONTEND_URL'),
  ];

  const origins = new Set<string>();
  for (const entry of raw) {
    const origin = toOrigin(String(entry || '').trim());
    if (origin) {
      origins.add(origin);
      // Le même site est souvent joint avec et sans www
      origins.add(origin.replace('://www.', '://'));
      origins.add(origin.replace('://', '://www.'));
    }
  }
  return [...origins];
}

/** Une origine dérivée n'est retenue que si elle est privée (hors prod) ou autorisée */
function acceptDerived(origin: string | undefined, configService: ConfigService): string | undefined {
  if (!origin) return undefined;
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return undefined;
  }

  // Hors production seulement : en prod, un hôte privé ne peut venir que d'un
  // en-tête injecté (le proxy nginx ne réécrit pas X-Forwarded-Host).
  const isProduction =
    String(configService.get<string>('NODE_ENV') || process.env.NODE_ENV || '') === 'production';
  if (!isProduction && isPrivateHostname(hostname)) return origin;

  return getAllowedOrigins(configService).includes(origin) ? origin : undefined;
}

/**
 * URL publique de CETTE API (base des callbacks passerelle), déduite de la requête.
 * Priorité : `x-forwarded-proto`/`x-forwarded-host` (derrière Caddy/Nginx) → `host`
 * → `BASE_URL` → `http://localhost:3001`.
 */
export function resolveApiBaseUrl(
  req: OriginRequestLike | undefined,
  configService: ConfigService,
): string {
  const host = firstHeader(req, 'x-forwarded-host') || firstHeader(req, 'host');
  const protocol =
    firstHeader(req, 'x-forwarded-proto') || (req?.secure ? 'https' : req?.protocol) || 'http';

  const derived = acceptDerived(toOrigin(host ? `${protocol}://${host}` : undefined), configService);
  const fallback = toOrigin(configService.get<string>('BASE_URL')) || 'http://localhost:3001';
  return (derived || fallback).replace(/\/+$/, '');
}

/**
 * URL publique du FRONT (base des URLs de retour), déduite de l'appelant.
 * Priorité : header `Origin` → origine du `Referer` → `FRONTEND_URL` → `http://localhost:3000`.
 */
export function resolveFrontendUrl(
  req: OriginRequestLike | undefined,
  configService: ConfigService,
): string {
  const candidate =
    toOrigin(firstHeader(req, 'origin')) || toOrigin(firstHeader(req, 'referer'));

  const derived = acceptDerived(candidate, configService);
  const fallback = toOrigin(configService.get<string>('FRONTEND_URL')) || 'http://localhost:3000';
  return (derived || fallback).replace(/\/+$/, '');
}
