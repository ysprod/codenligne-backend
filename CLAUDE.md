# Mon Étoile — Backend

API NestJS 11 (TypeScript) pour la plateforme de voyance. MongoDB + Redis/BullMQ.

## Stack

- **NestJS 11** + TypeScript 5, Node **20.10.0** (`.node-version`)
- **MongoDB** via `@nestjs/mongoose` (Mongoose 8) — `MONGODB_URI`
- **Redis** via `ioredis` + **BullMQ** (`@nestjs/bullmq`) — file d'analyse IA asynchrone
- **Auth** : Passport (JWT + local), `@nestjs/jwt`, bcrypt
- **Sécurité** : Helmet, `@nestjs/throttler` (rate limit, storage Redis)
- **WebSocket** : `@nestjs/platform-socket.io` — statut d'analyse temps réel
- **IA** : DeepSeek (`src/consultations/deepseek.service.ts`)
- **PDF** : `@react-pdf/renderer` (React 19 côté back, isolé pour la génération PDF)
- **Paiement** : MoneyFusion (`src/moneyfusion`, `src/payments`) ; Mobile Money via RayMoney ou FineoPay selon `PAYMENT_PROVIDER`

## Scripts

```bash
npm run start:dev          # API en watch (port 3001)
npm run start:worker:dev   # worker BullMQ (analyse IA) en watch
npm run build              # nest build -> dist/
npm run start:prod         # node dist/src/main.js
npm run start:worker       # node dist/src/worker.js
npm run redis:start        # docker redis:7-alpine sur 6379
npm test                   # jest (*.spec.ts sous src/)
npm run test:e2e           # jest e2e (test/jest-e2e.json)
```

`npm run lint` = no-op (`echo ESLint disabled`). Prettier configuré (`.prettierrc`).

Prod : conteneurs Docker (API + worker, `network_mode: host`) sur le VPS derrière Caddy — `make deploy` / `make update`, guide `README-DEPLOIEMENT.md`. (`ecosystem.config.js` / scripts `pm2:*` = héritage, non utilisés.) `npm run deploy` build + commit + push (attention : commit auto).

## Deux process

1. **API** (`src/main.ts`) — sert les endpoints HTTP + gateway WebSocket.
2. **Worker** (`src/worker.ts`) — consomme la queue BullMQ `analysis` et lance l'analyse IA des consultations. **Doit tourner** pour que les analyses se résolvent. Requiert Redis.

Constantes de queue : `src/queue/analysis-queue.constants.ts`. Connexion : `src/queue/redis.connection.ts`.

## Architecture

Module NestJS classique : chaque domaine = `*.module.ts` + `*.controller.ts` + `*.service.ts` + `schemas/` (Mongoose) + `dto/` (class-validator). Racine : `src/app.module.ts`.

Modules principaux (`src/`) :
- `auth/` — login/register, stratégies Passport (`strategies/jwt`, `local`)
- `users/` — utilisateurs + progression de grades (`user-grade-progress.module.ts`)
- `consultations/` — cœur métier : analyse IA (`analysis.service`, `analysis-db`, `analysis-queue`), choix/statuts, messages, DeepSeek, cinq portes (`slide4-section-doors`)
- `payments/` + `moneyfusion/` — paiements et vérification
- `raymoney/` — paiement Mobile Money RayMoney (achat offrandes) : payin, callback public vérifié par réconciliation, polling. Doc : `docs/RAYMONEY_OFFRANDES_IMPLEMENTATION.md`
- `fineopay/` — paiement via lien hébergé FineoPay (même parcours offrandes) : checkout-link, callback vérifié serveur→serveur, polling, réconciliation. Doc : `docs/FINEOPAY_INTEGRATION.md`. Passerelle active choisie par `PAYMENT_PROVIDER` (`raymoney` | `fineopay`, cf. `src/common/payment-provider.ts`), exposée au front par `GET /payments/provider`
- `payment-settings/` — passerelle active pilotable en back-office (SUPER_ADMIN), compteurs d'échecs, bascule sur incident (notification + SMS). La valeur en base l'emporte sur `PAYMENT_PROVIDER`
- `wallet/` — porte-monnaie
- `offerings/` + `offering-stock` — marché des offrandes + stock
- `books/`, `blog/`, `categories/`, `rubriques/` — contenu
- `grades/` — système de grades spirituels (seed : `npm run seed:grades`)
- `notifications/`, `messaging/` — notifs + messagerie
- `admin/` — endpoints admin
- `config/` — config runtime exposée
- `uploads/` — fichiers servis sous `/uploads/**`
- `doors-job/`, `services/`, `reviews/`, `redis/`

Transverse (`src/common/`) :
- `enums/role.enum.ts` — `SUPER_ADMIN > ADMIN > CONSULTANT > USER > GUEST` + `isRoleHigherOrEqual`
- `guards/` — `jwt-auth`, `roles`, `permissions`, `banned` (BannedGuard appliqué globalement dans main.ts)
- `decorators/` — `@Roles`, `@Permissions`, `@Public`, `@CurrentUser`
- `enums/` — permission, consultation-status, payment-status, user-type, user-grade

Temps réel : `analysis.gateway.ts` (WS) + `analysis-status.subscriber.ts` (Redis pub/sub -> push aux clients).

## Config / env

`ConfigModule` global, charge `.env.local` puis `.env`. Clés notables :
`MONGODB_URI`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `THROTTLE_TTL`, `THROTTLE_LIMIT`, secrets JWT, clés DeepSeek/MoneyFusion/RayMoney, `PAYMENT_PROVIDER` + `FINEOPAY_API`/`FINEOPAY_API_KEY`/`FINEOPAY_BUSINESS_CODE`.

Body limit 50 mb (uploads). CORS/CSP config dans `main.ts` (autorise `monetoile.org` + localhost:3000).

## Docs

`docs/` = ~35 guides markdown (grades, consultations, déploiement VPS, détection pays, prompts IA…). `docs/INDEX.md` et `docs/SYSTEM_MAP.md` pour la carte d'ensemble. `README.md` = doc complète FR.

## Conventions

- Français pour messages/commentaires produit.
- Path alias sans `src/` (ex. `import ... from 'common/guards/...'`) — voir `tsconfig.json` + `tsconfig-paths`.
- Un domaine = un module. Ajouter dans `app.module.ts` `imports`.
