import * as jwt from 'jsonwebtoken';
import type { Socket } from 'socket.io';
import { requireJwtSecret } from './jwt-secrets';

export interface SocketUser {
  sub: string;
  role?: string;
}

/**
 * Origines autorisées pour les gateways WebSocket (mêmes règles que le CORS HTTP
 * de main.ts). Évalué au chargement du décorateur : on lit process.env directement.
 */
export function socketCorsOrigins(): string[] {
  const baseUrl = process.env.BASE_URL || 'https://monetoile.org';
  const origins = [baseUrl, baseUrl.replace('https://', 'https://www.')];
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000');
  }
  return origins;
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) {
    return undefined;
  }
  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex > 0 && part.slice(0, separatorIndex).trim() === name) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }
  return undefined;
}

/**
 * Authentifie le handshake : jeton dans `auth.token`, l'en-tête Authorization
 * ou le cookie de session. Retourne null si absent ou invalide.
 */
export function authenticateSocket(client: Socket): SocketUser | null {
  const raw =
    client.handshake.auth?.token ||
    client.handshake.headers['authorization'] ||
    readCookie(client.handshake.headers.cookie, 'monetoile_access_token');

  if (!raw || typeof raw !== 'string') {
    return null;
  }

  try {
    const payload = jwt.verify(
      raw.replace(/^Bearer /, ''),
      requireJwtSecret('JWT_SECRET', process.env.JWT_SECRET),
    ) as jwt.JwtPayload;
    return typeof payload.sub === 'string' ? { sub: payload.sub, role: payload.role } : null;
  } catch {
    return null;
  }
}
