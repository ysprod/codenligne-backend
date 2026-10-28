# ============================================================================
# Mon Étoile — Backend (NestJS) — Makefile unique (racine)
# ----------------------------------------------------------------------------
# Piloté depuis TON ordinateur. Déploiement en CONTENEURS DOCKER sur le VPS
# (API + worker BullMQ), sous /opt/mon-etoile-backend. Guide : README-DEPLOIEMENT.md
#
#   LOCAL   (ton ordinateur, Node direct) : install, env, dev, worker, redis,
#                                            build, test, seed, seed-admins
#   DISTANT (laptop → VPS par SSH, Docker) : setup, deploy, release, update,
#                                            pull, env-push, env-check, up/start,
#                                            down/stop, restart, build-nc, ps/status,
#                                            logs, logs-worker, shell, clean, ssh
# ============================================================================
-include .env

# ── Déploiement (SSH + Docker) ──────────────────────────────────────────────
VPS_USER  ?= apimanager
VPS_HOST  ?= 51.210.42.70
APP_DIR   ?= /opt/mon-etoile-backend
REPO_URL  ?= git@gitlab.com:dss-civ/monetoilebackend.git
BRANCH    ?= main
RELEASE_FROM ?= develop
# Hôte Git déduit de REPO_URL (SSH ou HTTPS) → bascule GitLab/GitHub sans autre réglage
GIT_HOST := $(shell echo '$(REPO_URL)' | sed -E 's|^[a-z]+://||; s|.*@||; s|[:/].*||')
# Chemin d’ajout de la Deploy Key, déduit de GIT_HOST (affiché par make vps-key)
DEPLOY_KEY_HINT := $(if $(filter github.com,$(GIT_HOST)),Repo ▸ Settings ▸ Deploy keys ▸ Add deploy key,Projet ▸ Settings ▸ Repository ▸ Deploy keys ▸ Add key)

SSH_KEY   ?= $(HOME)/.ssh/id_ed25519
SSH_OPTS  ?= -i $(SSH_KEY) -o IdentitiesOnly=yes
SSH       := ssh $(SSH_OPTS) $(VPS_USER)@$(VPS_HOST)
SSHT      := ssh -t $(SSH_OPTS) $(VPS_USER)@$(VPS_HOST)

# ── Deux comptes sur le VPS (même principe que teach-me) ────────────────────
# VPS_USER  (apimanager) = DÉPLOIEMENT     : groupe docker seulement, PAS de sudo (voulu).
# VPS_ADMIN (debian)     = ADMINISTRATION  : groupe sudo (Caddy, ufw, systemd).
# Tout ce qui exige root est un SCRIPT versionné (deployment/scripts/), exécuté
# SUR le VPS où le mot de passe sudo est saisi. Depuis ce poste : les cibles
# `*-check` montrent sans root ; `caddy-sync` / `firewall` passent par VPS_ADMIN
# si ta clé y est autorisée, sinon affichent la commande exacte à lancer.
VPS_ADMIN      ?= debian
ADMIN_SSH_KEY  ?= $(SSH_KEY)
ADMIN_SSH_OPTS  = -i $(ADMIN_SSH_KEY) -o IdentitiesOnly=yes
SCRIPTS_DIR     = $(APP_DIR)/deployment/scripts
CADDY_SRC      := deployment/caddy/Caddyfile
# Domaine dérivé du Caddyfile : 1re ligne ouvrant un bloc site. Le domaine n’est
# donc déclaré qu’à un seul endroit (le Caddyfile). Sert à caddy-test.
# La classe [{}] garde les accolades APPARIÉES : un motif awk qui en ouvre une
# sans la refermer désynchronise la coloration syntaxique de l’éditeur à partir
# de la ligne suivante (make, lui, s’en accommodait très bien).
# Le bloc site commence en colonne 0 dans ce Caddyfile versionné.
DOMAIN     := $(shell grep -m1 '[{}]' $(CADDY_SRC) 2>/dev/null | cut -d' ' -f1 | tr -d ',')
DOMAIN     := $(if $(DOMAIN),$(DOMAIN),monetoile.org)

# ── Docker côté VPS ─────────────────────────────────────────────────────────
PROJECT_NAME = mon-etoile-api
SERVICE      = api
WORKER       = worker
REMOTE_DC    = $(APP_DIR)/deployment
# --env-file : parseur dotenv natif (tolère espaces/valeurs spéciales) pour les
# interpolations ${...}. Exécuté depuis deployment/ → .env.production à ../.
DC           = docker compose --env-file ../.env.production -p $(PROJECT_NAME) -f docker-compose.yml
# Dossiers montés (compose: ../logs, ../uploads). Conteneur non-root → hôte inscriptible.
PREP_DIRS    = mkdir -p ../logs ../uploads && { chmod -R 777 ../logs ../uploads 2>/dev/null || true; }

# ── Local ────────────────────────────────────────────────────────────────────
PM ?= npm

.PHONY: help install env dev worker redis redis-stop build test seed seed-admins \
        vps-key setup deploy release update pull env-push env-check up start down stop \
        restart build-nc status ps logs logs-worker shell clean ssh \
        vps-seed vps-seed-admins vps-db-ping \
        dev-key \
        caddy-check caddy-sync caddy-reload caddy-status caddy-logs caddy-test \
        firewall-check firewall ssh-admin

help:
	@echo "Mon Étoile Backend — cibles disponibles"
	@echo ""
	@echo "  LOCAL (ton ordinateur) :"
	@echo "    make install    - npm install + .env (généré si absent)"
	@echo "    make redis      - Redis local docker :6379 | make redis-stop"
	@echo "    make dev        - API en watch (:3001)"
	@echo "    make worker     - worker BullMQ (analyse IA) en watch"
	@echo "    make build/test - nest build / jest"
	@echo "    make seed / seed-admins - grades / comptes admin"
	@echo ""
	@echo "  DISTANT (SSH -> VPS, conteneurs Docker) :"
	@echo "    make vps-key    - genere/affiche la Deploy Key du VPS (a coller sur $(GIT_HOST))"
	@echo "    make setup      - 1ere installation (init + build image + up)"
	@echo "    make deploy     - push local + build/bascule zero-downtime (deploy.sh)"
	@echo "    make release    - promeut $(RELEASE_FROM) -> $(BRANCH) puis deploie"
	@echo "    make update     - secours : recale le VPS sur origin/$(BRANCH) + deploy.sh"
	@echo "    make env-push   - envoie .env.production -> VPS"
	@echo "    make up/start   - demarre | make down/stop - arrete | make restart"
	@echo "    make build-nc   - rebuild image sans cache | make clean - nettoie Docker"
	@echo "    make ps/status  - etat | make logs / logs-worker - logs live"
	@echo "    make shell      - sh dans le conteneur API | make ssh - session SSH"
	@echo "    make vps-seed-admins - cree le SUPER_ADMIN en prod (dans le conteneur)"
	@echo "    make vps-seed        - seed des grades en prod | RESET=1 reinit mdp admin"
	@echo "    make vps-db-ping     - teste MongoDB depuis le VPS (meme si l API ne demarre pas)"
	@echo "    make dev-key         - autorise un nouveau dev (KEYFILE=~/x.pub) a make deploy"
	@echo ""
	@echo "  RACINE DU VPS (Caddy, ufw) - scripts versionnes executes SUR le VPS :"
	@echo "    make caddy-check    - diff + validation du Caddyfile (sans root)"
	@echo "    make caddy-sync     - applique le Caddyfile + reload (root : via $(VPS_ADMIN) ou instructions)"
	@echo "    make firewall-check / firewall - regles ufw : 22/80/443 ouverts, 3000/3001 fermes"
	@echo "    make caddy-test / caddy-status / caddy-logs | make ssh-admin - session $(VPS_ADMIN) (sudo)"
	@echo ""
	@echo "  VPS_USER=$(VPS_USER) VPS_HOST=$(VPS_HOST) APP_DIR=$(APP_DIR) BRANCH=$(BRANCH)"

# ===========================================================================
# LOCAL — développement direct avec Node (pas de Docker chez toi)
# ===========================================================================
install: env
	$(PM) install

env:
	@if [ -f .env ]; then \
		echo "✓ .env déjà présent — rien à faire."; \
	else \
		JWT_SECRET=$$(openssl rand -hex 32); \
		JWT_REFRESH_SECRET=$$(openssl rand -hex 32); \
		{ \
		printf '%s\n' \
		'# Mon Étoile Backend — env de dev local (généré par make env)' \
		'NODE_ENV=development' \
		'PORT=3001' \
		'BASE_URL=http://localhost:3001' \
		'FRONTEND_URL=http://localhost:3000' \
		'' \
		'# MongoDB (local — voir docs/INSTALLATION_MONGODB_LOCAL.md)' \
		'MONGODB_URI=mongodb://localhost:27017/monetoile' \
		'' \
		'# Redis (make redis => docker :6379, sans mot de passe)' \
		'REDIS_HOST=127.0.0.1' \
		'REDIS_PORT=6379' \
		'REDIS_PASSWORD=' \
		'REDIS_USERNAME=' \
		'REDIS_DB=0' \
		'' \
		'# Auth JWT (expirations en SECONDES)' \
		"JWT_SECRET=$$JWT_SECRET" \
		"JWT_REFRESH_SECRET=$$JWT_REFRESH_SECRET" \
		'JWT_EXPIRATION=604800' \
		'JWT_REFRESH_EXPIRATION=2592000' \
		'BCRYPT_ROUNDS=10' \
		'' \
		'AUTH_COOKIE_DOMAIN=localhost' \
		'AUTH_COOKIE_SECURE=false' \
		'AUTH_COOKIE_SAMESITE=lax' \
		'' \
		'THROTTLE_TTL=60' \
		'THROTTLE_LIMIT=100' \
		'' \
		'UPLOAD_DIR=./uploads' \
		'PUBLIC_UPLOAD_URL=http://localhost:3001/uploads' \
		'ANALYSIS_WORKER_CONCURRENCY=2' \
		'' \
		'# ── Clés externes — À COMPLÉTER ──────────────────────────────' \
		'DEEPSEEK_API_KEY=' \
		'RAYMONEY_API=https://app.rayplusmoney.com/pay/v01/straight' \
		'RAYMONEY_KEY=' \
		'RAYMONEY_TOKEN=' \
		'' \
		'# ── Comptes admin (make seed-admins) ─────────────────────────' \
		'SUPER_ADMIN_USERNAME=MrMaguy' \
		'SUPER_ADMIN_PASSWORD=' \
		'SUPER_ADMIN_PHONE=' \
		'' \
		'# ── Déploiement (lu par ce Makefile — SSH vers le VPS) ───────' \
		'VPS_USER=apimanager' \
		'VPS_HOST=51.210.42.70' \
		'APP_DIR=/opt/mon-etoile-backend' \
		'REPO_URL=git@gitlab.com:dss-civ/monetoilebackend.git' \
		'BRANCH=main' \
		'' \
		'# Compte ADMINISTRATION du VPS (groupe sudo) : make caddy-sync, firewall, ssh-admin' \
		'VPS_ADMIN=debian' ; \
		} > .env; \
		echo "→ .env généré (secrets JWT aléatoires)."; \
		echo "  ⚠ Complète les clés externes + SUPER_ADMIN_PASSWORD."; \
	fi

redis:
	$(PM) run redis:start

redis-stop:
	$(PM) run redis:stop

dev:
	NODE_OPTIONS="-r dotenv/config" $(PM) run start:dev

worker:
	NODE_OPTIONS="-r dotenv/config" $(PM) run start:worker:dev

build:
	$(PM) run build

test:
	$(PM) test

seed:
	$(PM) run seed:grades

seed-admins:
	$(PM) run seed:admins

# ===========================================================================
# DISTANT — pilotage du VPS par SSH (Docker Compose depuis $(APP_DIR)/deployment)
# ===========================================================================

# Première installation : clone + .env.production + build image + up.
# Prérequis VPS : git, docker + docker compose, utilisateur $(VPS_USER) dans le
# groupe docker. Le .env.production doit être présent (make env-push d’abord).
# Génère (si absente) la clé SSH du VPS et affiche sa clé PUBLIQUE à coller comme
# Deploy Key (lecture seule) sur ton hébergeur. Le chemin exact ($(DEPLOY_KEY_HINT))
# et la clé d’hôte ajoutée au VPS ($(GIT_HOST)) sont déduits de REPO_URL.
vps-key:
	$(SSH) '\
		set -e ; mkdir -p ~/.ssh && chmod 700 ~/.ssh ; \
		grep -q "$(GIT_HOST)" ~/.ssh/known_hosts 2>/dev/null || ssh-keyscan -t ed25519,rsa $(GIT_HOST) >> ~/.ssh/known_hosts 2>/dev/null ; \
		[ -f ~/.ssh/id_ed25519 ] || ssh-keygen -t ed25519 -C "$(VPS_USER)@dss-vps" -f ~/.ssh/id_ed25519 -N "" ; \
		KEY=$$(cut -d" " -f1-2 ~/.ssh/id_ed25519.pub) ; printf "%s %s\n" "$$KEY" "$(VPS_USER)@dss-vps" > ~/.ssh/id_ed25519.pub ; \
		echo "" ; echo "===== COLLE CETTE CLÉ COMME DEPLOY KEY SUR $(GIT_HOST) (lecture seule) =====" ; \
		cat ~/.ssh/id_ed25519.pub ; \
		echo "==================================================================" ; \
		echo "$(DEPLOY_KEY_HINT)" '

setup:
	$(SSH) '\
		set -e ; mkdir -p ~/.ssh && chmod 700 ~/.ssh ; \
		grep -q "$(GIT_HOST)" ~/.ssh/known_hosts 2>/dev/null || ssh-keyscan -t ed25519,rsa $(GIT_HOST) >> ~/.ssh/known_hosts 2>/dev/null ; \
		mkdir -p $(APP_DIR) ; cd $(APP_DIR) ; \
		git init -q ; \
		git remote add origin $(REPO_URL) 2>/dev/null || git remote set-url origin $(REPO_URL) ; \
		git fetch origin $(BRANCH) ; git checkout -f -B $(BRANCH) origin/$(BRANCH) ; \
		if [ ! -f .env.production ]; then echo "❌ cree $(APP_DIR)/.env.production (make env-push depuis ton poste)" ; exit 1 ; fi ; \
		cd deployment && $(PREP_DIRS) && $(DC) build --no-cache $(SERVICE) && $(DC) up -d --remove-orphans '

# Déploiement : push local puis, sur le VPS, pull + build/bascule zero-downtime
# (deployment/scripts/deploy.sh) + reload worker.
deploy:
	@git diff --quiet && git diff --cached --quiet || echo "⚠ Modifications non commitées — elles ne partiront PAS sur le serveur."
	git push origin $(BRANCH)
	$(SSH) '\
		set -e ; cd $(APP_DIR) ; \
		if [ ! -f .env.production ]; then echo "❌ .env.production manquant — fais make env-push" ; exit 1 ; fi ; \
		git fetch origin $(BRANCH) ; git reset --hard origin/$(BRANCH) ; \
		cd deployment && chmod +x scripts/deploy.sh && ./scripts/deploy.sh '
	@echo "✅ Déployé sur $(VPS_HOST) ($(BRANCH))."

# Release : promeut $(RELEASE_FROM) → $(BRANCH) puis déploie. C’est $(BRANCH)
# qui s’installe sur le VPS.
release:
	@# Garde : la release fait `git reset --hard` sur $(BRANCH) — du non-commité y serait PERDU
	@test -z "$$(git status --porcelain)" || { echo "❌ Modifications non commitées — release annulée (commite d'abord)."; git status --short; exit 1; }
	@test "$$(git branch --show-current)" = "$(RELEASE_FROM)" || { echo "❌ Release depuis $(RELEASE_FROM) uniquement."; exit 1; }
	@# Tests (dont le démarrage complet d'AppModule) avant toute mise en prod
	$(PM) test
	@echo "🚀 Release : $(RELEASE_FROM) → $(BRANCH)"
	git push origin $(RELEASE_FROM)
	git fetch origin
	git checkout $(BRANCH)
	git reset --hard origin/$(BRANCH)
	git merge --no-ff origin/$(RELEASE_FROM) -m "release: merge $(RELEASE_FROM) into $(BRANCH)"
	git push origin $(BRANCH)
	git checkout $(RELEASE_FROM)
	@$(MAKE) deploy
	@echo "✅ $(BRANCH) déployé."

# Secours : recale le VPS sur origin/$(BRANCH) + rebuild/bascule, sans push local.
update:
	$(SSH) '\
		set -e ; cd $(APP_DIR) ; \
		git remote set-url origin $(REPO_URL) ; \
		git fetch origin $(BRANCH) ; git reset --hard origin/$(BRANCH) ; \
		cd deployment && chmod +x scripts/deploy.sh && ./scripts/deploy.sh '
	@echo "✅ VPS recalé sur origin/$(BRANCH) et redéployé."

pull:
	$(SSH) 'cd $(APP_DIR) && git fetch origin $(BRANCH) && git reset --hard origin/$(BRANCH)'

# Envoie le .env.production LOCAL -> VPS (secrets, non versionnés).
env-push:
	@[ -f .env.production ] || { echo "❌ .env.production introuvable en local"; exit 1; }
	@grep -q "^RAYMONEY_KEY=.\+" .env.production || echo "⚠ RAYMONEY_KEY vide dans .env.production — le paiement des offrandes ne marchera pas."
	$(SSH) 'mkdir -p $(APP_DIR)'
	scp $(SSH_OPTS) .env.production $(VPS_USER)@$(VPS_HOST):$(APP_DIR)/.env.production
	@echo "✅ .env.production poussé — applique : make deploy (ou make restart)"

env-check:
	$(SSH) 'test -f $(APP_DIR)/.env.production && echo ".env.production present" || echo "ATTENTION: .env.production manquant"'

up start:
	$(SSH) 'cd $(REMOTE_DC) && $(PREP_DIRS) && $(DC) up -d --remove-orphans'

down stop:
	$(SSH) 'cd $(REMOTE_DC) && $(DC) down'

restart:
	$(SSH) 'cd $(REMOTE_DC) && $(DC) restart $(SERVICE) $(WORKER)'

build-nc:
	$(SSH) 'cd $(REMOTE_DC) && $(DC) build --no-cache $(SERVICE) && docker image prune -f'

status ps:
	$(SSH) 'cd $(REMOTE_DC) && $(DC) ps'

logs:
	$(SSHT) 'cd $(REMOTE_DC) && $(DC) logs -f --tail=100 $(SERVICE)'

logs-worker:
	$(SSHT) 'cd $(REMOTE_DC) && $(DC) logs -f --tail=100 $(WORKER)'

shell:
	$(SSHT) 'cd $(REMOTE_DC) && $(DC) exec $(SERVICE) /bin/sh'

# ── Seed EN PRODUCTION (dans le conteneur, atteint le Mongo du VPS) ──────────
# Le Mongo de prod n’est PAS joignable depuis ton poste (localhost du VPS) → on
# exécute le seed DANS le conteneur api, qui a MONGODB_URI + SUPER_ADMIN_* via
# env_file. Scripts compilés dans l’image (dist/scripts/, cf. Dockerfile).
# Compte SUPER_ADMIN : make vps-seed-admins  (RESET=1 pour réinitialiser le mdp)
vps-seed-admins:
	$(SSH) 'cd $(REMOTE_DC) && $(DC) exec -T $(SERVICE) node dist/scripts/seed-admins.js $(if $(RESET),--reset-password,)'

# Grades spirituels (idempotent).
vps-seed:
	$(SSH) 'cd $(REMOTE_DC) && $(DC) exec -T $(SERVICE) node dist/scripts/seed-grades.js'

# Diagnostic MongoDB DEPUIS le VPS (son IP, son réseau). `run --rm` et non `exec` :
# marche aussi quand l'API boucle au démarrage faute de base — le cas où on en a besoin.
vps-db-ping:
	$(SSH) 'cd $(REMOTE_DC) && $(DC) run --rm --no-deps -T $(SERVICE) node dist/scripts/db-ping.js'

clean:
	$(SSH) 'docker system prune -f && docker image prune -f'

ssh:
	$(SSHT)

# ===========================================================================
# ACTIONS ROOT (Caddy, ufw) — scripts versionnés exécutés SUR le VPS
# (deployment/scripts/caddy-sync.sh, firewall.sh). Doc : deployment/caddy/README.md
# Dépendance `pull` : le script et le Caddyfile lus sont ceux d'origin/$(BRANCH).
# ===========================================================================

# $(call ROOT_RUN,<commande>) — lance `sudo <commande>` via VPS_ADMIN si ta clé y
# est autorisée (sudo demande le mot de passe SUR le VPS, session -t) ; sinon
# explique quoi taper, au lieu d'échouer sur un « Permission denied ».
define ROOT_RUN
@if ssh $(ADMIN_SSH_OPTS) -o BatchMode=yes -o ConnectTimeout=10 $(VPS_ADMIN)@$(VPS_HOST) true 2>/dev/null ; then \
  echo "→ via $(VPS_ADMIN)@$(VPS_HOST) — sudo va demander le mot de passe sur le VPS" ; \
  ssh -t $(ADMIN_SSH_OPTS) $(VPS_ADMIN)@$(VPS_HOST) 'sudo $(1)' ; \
else \
  echo "" ; \
  echo "ℹ  Action root, à exécuter SUR le VPS : $(VPS_USER) (déploiement) n'a pas sudo — c'est voulu." ; \
  echo "   Ouvre une session d'administration et lance :" ; \
  echo "" ; \
  echo "     ssh $(VPS_ADMIN)@$(VPS_HOST)" ; \
  echo "     sudo $(1)" ; \
  echo "" ; \
  echo "   (Pour que make le fasse : autorise ta clé chez $(VPS_ADMIN), ou ADMIN_SSH_KEY=~/.ssh/ta_cle.)" ; \
  exit 1 ; \
fi
endef

# Montre ce que caddy-sync CHANGERAIT dans /etc/caddy/Caddyfile, et valide. Sans root.
caddy-check: pull
	$(SSH) '$(SCRIPTS_DIR)/caddy-sync.sh --dry-run'

# Applique le Caddyfile du dépôt (bloc géré, validé, sauvegardé) + reload. Root.
caddy-sync: pull
	$(call ROOT_RUN,$(SCRIPTS_DIR)/caddy-sync.sh)

# Ancien nom, gardé pour les habitudes et la doc.
caddy-reload: caddy-sync

# Lecture seule : compte de déploiement.
caddy-status:
	$(SSH) 'systemctl --no-pager status caddy | head -15'

# journalctl de caddy : réservé à root / groupe adm → compte d'administration.
caddy-logs:
	$(call ROOT_RUN,journalctl -u caddy -n 100 -f --no-pager)

caddy-test:
	@curl -sI https://$(DOMAIN) | head -5
	@curl -s -o /dev/null -w 'API /api/v1 : HTTP %{http_code}\n' https://$(DOMAIN)/api/v1

# Règles ufw : 22/80/443 ouverts, 3000/3001 fermés. `firewall-check` montre (sans root).
firewall-check: pull
	$(SSH) '$(SCRIPTS_DIR)/firewall.sh --dry-run'

firewall: pull
	$(call ROOT_RUN,$(SCRIPTS_DIR)/firewall.sh)

# Session SSH sur le compte d'ADMINISTRATION (sudo) — pas `make ssh` (= $(VPS_USER)).
ssh-admin:
	ssh -t $(ADMIN_SSH_OPTS) $(VPS_ADMIN)@$(VPS_HOST)

# ===========================================================================
# ACCÈS DEV — autorise un nouveau dev à `make deploy`.
# Ajoute SA clé PUBLIQUE dans l'authorized_keys de $(VPS_USER), via $(VPS_USER)
# lui-même (pas besoin de root). Idempotent. Le même accès sert front ET back.
#   make dev-key KEYFILE=~/le-dev.pub                    (recommandé)
#   make dev-key KEY="ssh-ed25519 AAAA... dev@laptop"
# Le dev génère sa clé chez lui : ssh-keygen -t ed25519  puis envoie le .pub.
# ===========================================================================
dev-key:
	@KEY_VAL='$(KEY)' ; \
	if [ -n '$(KEYFILE)' ]; then KEY_VAL="$$(cat '$(KEYFILE)')" || exit 1 ; fi ; \
	if [ -z "$$KEY_VAL" ]; then echo 'Usage: make dev-key KEYFILE=~/le-dev.pub   (ou KEY="ssh-ed25519 AAA... commentaire")' ; exit 1 ; fi ; \
	case "$$KEY_VAL" in ssh-ed25519\ *|ssh-rsa\ *|ecdsa-sha2-*\ *) : ;; *) echo '❌ Clé publique invalide (attendu : ssh-ed25519 / ssh-rsa / ecdsa-sha2-…)' ; exit 1 ;; esac ; \
	printf '%s\n' "$$KEY_VAL" | $(SSH) 'set -e ; umask 077 ; \
		install -d -m700 "$$HOME/.ssh" ; A="$$HOME/.ssh/authorized_keys" ; touch "$$A" ; chmod 600 "$$A" ; \
		K="$$(cat)" ; \
		if grep -qxF "$$K" "$$A" ; then echo "✓ Clé déjà présente (rien à faire)" ; else printf "%s\n" "$$K" >> "$$A" ; echo "✅ Clé dev ajoutée -> make deploy possible sur $(VPS_USER)@$(VPS_HOST)" ; fi ; \
		chmod 600 "$$A"'
