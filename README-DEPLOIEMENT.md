# Mon Étoile Backend — Guide de déploiement

> **API NestJS & Worker d'analyse IA** (BullMQ) — Backend de la plateforme de voyance et spiritualité africaine **Mon Étoile**.

---

## Table des matières

- [Stack technique](#stack-technique)
- [Architecture et Fonctionnement](#architecture-et-fonctionnement)
- [Développement local](#développement-local)
- [Déploiement (VPS)](#déploiement-vps)
  - [Le vocabulaire en 1 minute](#le-vocabulaire-en-1-minute)
  - [Deux ordinateurs, ne pas les confondre](#deux-ordinateurs-ne-pas-les-confondre)
  - [Étape 1 — Préparer le VPS](#étape-1--préparer-le-vps)
  - [Étape 1 bis — MongoDB : préparer la base](#étape-1-bis--mongodb--préparer-la-base)
    - [Topologie A — MongoDB Atlas](#topologie-a--mongodb-atlas-managée)
    - [Topologie B — MongoDB natif sur ce VPS (prod actuelle)](#topologie-b--mongodb-natif-sur-ce-vps-production-actuelle)
    - [Topologie C — MongoDB sur un autre serveur, via tunnel SSH](#topologie-c--mongodb-sur-un-autre-serveur-via-tunnel-ssh)
  - [Étape 1 ter — Deux comptes, deux rôles](#étape-1-ter--deux-comptes-deux-rôles)
  - [Étape 2 — Créer l'utilisateur dédié `apimanager`](#étape-2--créer-lutilisateur-dédié-apimanager)
  - [Étape 3 — Clé SSH n°1 : ton ordinateur → le VPS](#étape-3--clé-ssh-n1--ton-ordinateur--le-vps)
  - [Étape 4 — Clé SSH n°2 : le VPS → le dépôt Git (Deploy Key)](#étape-4--clé-ssh-n2--le-vps--le-dépôt-git-deploy-key)
    - [Version A — GitLab](#version-a--gitlab)
    - [Version B — GitHub](#version-b--github)
  - [Étape 5 — Configurer la télécommande (`.env` local)](#étape-5--configurer-la-télécommande-env-local)
  - [Étape 6 — Première mise en ligne (setup)](#étape-6--première-mise-en-ligne-setup)
  - [Étape 7 — Accès par IP](#étape-7--accès-par-ip-pas-de-domaine-pour-linstant)
  - [Étape 8 — Activer le Pare-feu](#étape-8--activer-le-pare-feu)
- [Mises à jour suivantes (deploy)](#mises-à-jour-suivantes-deploy)
- [Variables d'environnement](#variables-denvironnement)
- [Dépannage et maintenance](#dépannage-et-maintenance)

---

## Stack technique

| Composant             | Technologie                                                               |
| --------------------- | ------------------------------------------------------------------------- |
| Framework             | NestJS 11 (TypeScript, Node 20)                                           |
| Base de données       | MongoDB                                                                   |
| Files d'attente       | Redis + BullMQ (processus asynchrones d'analyse IA)                       |
| Accès public          | HTTPS **`monetoile.org`** via **Caddy** (natif sur le VPS, Let's Encrypt) |
| Conteneurisation      | Docker + Docker Compose (API + worker)                                    |
| Build & exécution VPS | Docker (image reconstruite à chaque déploiement)                          |

---

## Architecture et Fonctionnement

```
┌─────────────────────────┐           ┌────────────────────────────────────────────────────────┐
│  TON ORDINATEUR         │           │  VPS (51.210.42.70)                                     │
│  ─────────────────────  │    SSH    │  ─────────────────────────────────────────────────────  │
│  code + make deploy ────┼──────────▶│  Utilisateur : apimanager                              │
│                         │           │  Dossier : /opt/mon-etoile-backend                 │
│  .env.production        │           │  Conteneurs Docker :                                   │
│  make env-push ─────────┼──────────▶│   • mon-etoile-api    (:3001)                          │
│                         │           │   • mon-etoile-worker (analyses IA)                    │
│                         │           │  Bases : MongoDB natif (127.0.0.1) + Redis (conteneur)  │
│                         │           │  Caddy : https://monetoile.org/api/v1 → 127.0.0.1:3001  │
│                         │           │  (API en network_mode host ; Caddy = seul point public) │
└─────────────────────────┘           └────────────────────────────────────────────────────────┘
```

- **Sécurité** : L'application tourne sous l'utilisateur isolé `apimanager`.
- **Worker** : Complètement séparé de l'API HTTP, il écoute la file d'attente Redis pour générer les rapports astrologiques et de voyance par l'IA (DeepSeek). **Il doit tourner** pour que les consultations avancent.

---

## Développement local

### Prérequis

- Node.js ≥ 20
- `npm` (fourni avec Node.js)
- Docker (pour le Redis local)

### Démarrer (pas à pas)

```bash
# 1. Installer les dépendances et générer le fichier .env de dev
make install  # (lance npm install et génère un .env pré-configuré)

# 2. Lancer un conteneur Redis local (Docker)
make redis

# 3. Lancer l'API en mode watch (port 3001)
make dev

# 4. Lancer le worker BullMQ (dans un autre terminal)
make worker
```

- Si tu as besoin de réinitialiser la base locale avec les configurations de grades par défaut : `make seed`.
- Créer des administrateurs par défaut en local : `make seed-admins`.

---

## Déploiement (VPS)

### Le vocabulaire en 1 minute

- **VPS** : Un serveur distant allumé 24h/24.
- **SSH** : Protocole sécurisé pour exécuter des commandes à distance.
- **Clé SSH** : Clé privée (reste sur ton ordinateur) et clé publique (déposée sur le VPS).
- **Docker** : Chaque appli (API, worker, frontend) tourne dans un conteneur isolé, relancé automatiquement (`restart: always`) s'il plante ou au reboot du VPS.
- **Accès par IP** : Sans domaine, on ouvre les ports des conteneurs sur l'hôte et on accède par `http://IP:port`. Avec le domaine, c'est **Caddy** (installé nativement sur le VPS) qui sert `monetoile.org` en HTTPS (Étape 7 bis).

### Deux ordinateurs, ne pas les confondre

- **Ton ordinateur** : Tu développes avec Node.js (`npm`). Pas de Docker de déploiement ici (juste Node + un Redis Docker local).
- **Le VPS** : Le serveur Linux de production. Le code y tourne dans des **conteneurs Docker** lancés par l'utilisateur **`apimanager`**, sous `/opt/`.

Les commandes `make` se lancent sur **ton ordinateur** et pilotent le VPS via SSH.

---

### Étape 1 — Préparer le VPS

Connecte-toi en `root` sur ton serveur et installe les composants nécessaires :

```bash
apt update && apt upgrade -y
apt install -y git curl make ufw

# Installation de Docker + Docker Compose (plugin)
curl -fsSL https://get.docker.com | sh
# Docker démarre au boot du VPS
systemctl enable docker
```

> [!NOTE]
> **Le HTTPS est assuré par Caddy**, installé nativement sur le VPS (paquet
> système + systemd, certificats Let's Encrypt automatiques). Il route
> `/api/v1`, `/socket.io`, `/uploads` → API `127.0.0.1:3001` et le reste → front
> `127.0.0.1:3000`. Config **versionnée** dans
> **[`deployment/caddy/Caddyfile`](deployment/caddy/Caddyfile)**, pilotée par
> `make caddy-*` (voir [`deployment/caddy/README.md`](deployment/caddy/README.md)
> et l'[Étape 7 bis](#étape-7-bis--domaine--https-via-caddy)).

#### Bases de données (MongoDB & Redis) :

> [!IMPORTANT]
> **MongoDB natif sur le VPS, Redis en conteneur.**
>
> - **MongoDB** est installé **nativement sur ce VPS** (pas dans Docker), lié à
>   `127.0.0.1` → **invisible de l'extérieur**. Pour que le conteneur l'atteigne
>   sans exposer Mongo, l'API et le worker tournent en **`network_mode: host`**
>   (défini dans `deployment/docker-compose.yml`) : ils partagent le loopback de
>   l'hôte, donc `localhost:27017` vise bien le Mongo natif.
>   Installation, utilisateurs, vérifications — et les alternatives Atlas /
>   serveur distant : **[Étape 1 bis](#étape-1-bis--mongodb--préparer-la-base)**.
>
>   > Conséquence du réseau hôte : l'API écoute directement sur l'hôte
>   > (`0.0.0.0:3001`), et c'est **Caddy** (via 127.0.0.1) qui la sert
>   > publiquement ; 3001 est fermé au public par ufw. Assure-toi qu'aucun autre
>   > process ne tienne déjà 3001.
>
> - **Redis** tourne dans un **conteneur Docker** du VPS (`redis`, image
>   `redis:6.2`, partagé avec d'autres applis), publié sur le port `6379` et
>   protégé par mot de passe (`requirepass`). Vars : `REDIS_HOST`, `REDIS_PORT`,
>   `REDIS_PASSWORD`, `REDIS_DB=1` (cache + files BullMQ).
>   ⚠️ Un port publié par Docker **contourne ufw** : son mot de passe est la
>   seule protection de ce Redis — le choisir long et aléatoire.

---

### Étape 1 bis — MongoDB : préparer la base

Trois façons d'héberger la base. **La production actuelle est en B.** A et C
sont documentées pour une migration ou un nouveau VPS.

| Topologie | Où vit la base                       | `MONGODB_URI` (forme)                                                                     |
| --------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| **A**     | MongoDB Atlas (managée)              | `mongodb+srv://USER:MDP@cluster0.xxxxx.mongodb.net/monetoile?retryWrites=true&w=majority` |
| **B** ✅  | Natif sur **ce** VPS (prod actuelle) | `mongodb://USER:MDP@localhost:27017/monetoile?authSource=monetoile`                       |
| **C**     | Autre serveur, joint par tunnel SSH  | `mongodb://USER:MDP@127.0.0.1:27018/monetoile?authSource=admin&directConnection=true`     |

Le nom de la base est **le segment de chemin** de l'URI (`/monetoile`). Il n'y a
pas de variable séparée : c'est ce nom exact que les rôles MongoDB doivent porter.

> [!NOTE]
> **Plus simple ici que dans les guides Docker génériques.** L'API et le worker
> tournent en `network_mode: host` : dans le conteneur, `localhost` **est**
> l'hôte. Donc, contrairement à un conteneur sur réseau bridge :
>
> - pas de passerelle `172.17.0.1` ni de `host.docker.internal` ;
> - `mongod` reste en `bindIp: 127.0.0.1` — rien à élargir ;
> - aucune règle ufw pour laisser passer le conteneur (le trafic reste sur la
>   boucle locale `lo`, qu'ufw accepte d'office).
>
> ⚠️ **Si un jour on retire `network_mode: host`** (retour au bridge), tout cela
> revient d'un coup : `bindIp` doit inclure la passerelle du bridge, l'hôte
> devient `host.docker.internal` (+ `extra_hosts: ["host.docker.internal:host-gateway"]`),
> et ufw doit autoriser `172.16.0.0/12` sur 27017 **avant** tout `deny 27017`
> — sinon connexion **expirée** (DROP), « MongoDB injoignable », sans autre indice.
> `/12` et non `/16` : le réseau d'un compose n'est pas le bridge par défaut
> (souvent `172.18.0.0/16`, et il peut glisser en 172.19/172.20 après un
> `down`/`up`).

> [!WARNING]
> **À quoi ressemble une base injoignable, chez nous.** Pas de 503 : NestJS
> n'ouvre le port HTTP qu'**après** la connexion Mongoose, et le healthcheck
> (`GET /api/v1`) ne touche pas la base. Donc :
>
> - au démarrage, les logs répètent
>   `[MongooseModule] Unable to connect to the database. Retrying (1)...`,
>   puis l'API plante (`retryAttempts: 3`, `src/app.module.ts`) et
>   `restart: always` la relance **en boucle** ;
> - `make deploy` affiche `❌ L'API n'est pas saine` au bout de **90 s**
>   (18 × 5 s dans `deploy.sh`) — avant même que Mongoose ait fini ses essais ;
> - si la base tombe **après** le démarrage : l'API répond, mais chaque requête
>   qui touche la base échoue en 500 sur `buffering timed out after 10000ms`.
>
> **Diagnostic : `make vps-db-ping`.** Il lance un conteneur jetable (`run --rm`,
> pas `exec`) avec le `.env.production` et le réseau du VPS : il marche donc
> **même quand l'API boucle**, et c'est l'IP du VPS qui est testée — pas celle de
> ton poste. Il traduit le message du driver :
>
> | Message                                          | Cause probable                                                           |
> | ------------------------------------------------ | ------------------------------------------------------------------------ |
> | `tlsv1 alert internal error` (Atlas)             | IP du VPS absente de la liste d'accès Atlas (voir A)                     |
> | `ECONNREFUSED`                                   | Rien n'écoute : `mongod` arrêté, tunnel tombé, mauvais port              |
> | `Server selection timed out` sans refus          | Paquets jetés : pare-feu, mauvais hôte                                   |
> | `Authentication failed`                          | Utilisateur / mot de passe / `authSource` ; caractère spécial non encodé |
> | `not authorized on monetoile to execute command` | Authentifié, mais le rôle porte sur une **autre** base                   |

> [!IMPORTANT]
> **Mot de passe dans l'URI : encoder les caractères spéciaux.** `@ : / ? # [ ] %`
> cassent le parsing de l'URI (`@` → `%40`, `:` → `%3A`, `/` → `%2F`…). Symptôme :
> `Authentication failed` avec un mot de passe pourtant juste, ou une URI jugée
> invalide. Encoder : `node -e 'console.log(encodeURIComponent(process.argv[1]))' 'le-mdp'`.

#### Topologie A — MongoDB Atlas (managée)

Rien à installer, mais **une chose à faire, et elle est invisible si on
l'oublie** : ajouter l'IP publique du VPS dans **Atlas → Network Access → IP
Access List** — `51.210.42.70/32`.

> [!WARNING]
> Atlas rejette une IP non autorisée par une **erreur TLS** —
> `tlsv1 alert internal error`, sur les trois nœuds du replica set — **jamais**
> par un refus d'authentification. Le message ne parle ni d'IP ni de liste
> d'accès : on cherche longtemps du côté des certificats.
>
> Le signe qui distingue : le TCP passe (les nœuds répondent), c'est la poignée
> de main TLS qui casse. Même piège avec l'IP d'un poste de développement qui
> change chez l'opérateur : Compass marchait hier, plus aujourd'hui.
>
> Ne **jamais** mettre `0.0.0.0/0` pour « débloquer » : la base serait ouverte à
> tout internet, protégée par le seul mot de passe.

Confirmer l'IP **sortante** du VPS (elle peut différer de celle où l'on se
connecte si le VPS a plusieurs adresses) :

```bash
make ssh     # puis, sur le VPS :
curl -4 -s https://ifconfig.me; echo
```

Côté Atlas, **Database Access** : un utilisateur avec le rôle `readWrite` sur la
base `monetoile` seulement (_Specific Privileges_), pas `atlasAdmin`.

`.env.production` (topologie A) — `+srv` active TLS tout seul, rien à ajouter :

```ini
MONGODB_URI=mongodb+srv://monetoile_app:MDP-ENCODÉ@cluster0.xxxxx.mongodb.net/monetoile?retryWrites=true&w=majority
```

Vérifier **depuis le VPS**, pas depuis ton poste — c'est son IP qui compte :

```bash
make env-push && make vps-db-ping
```

#### Topologie B — MongoDB natif sur ce VPS (production actuelle)

État relevé sur le VPS le 12/09/2026 : **Debian 13 (trixie)**, `mongod`
**8.0.32** (dépôt `bookworm`, service actif), `bindIp: 127.0.0.1`,
`authorization: enabled`, écoute sur `127.0.0.1:27017` uniquement. Comptes :
`admin.monetoile_dbadmin` (administration) et `monetoile.monetoile_app`
(`readWrite` sur `monetoile`, celui de `MONGODB_URI`). Les étapes ci-dessous
servent à une **réinstallation** ou un nouveau VPS — et les vérifications (d, e),
à tout moment.

> Toutes ces commandes se lancent **en `root` sur le VPS** (ou via `sudo` depuis
> le compte admin `debian`) : `apimanager` n'a pas les droits d'installer ni
> d'éditer `/etc/mongod.conf`.

**a) Installer MongoDB.** Le paquet vient de **MongoDB Inc.**, pas des dépôts de
la distribution (celui de Debian/Ubuntu retarde de plusieurs versions majeures).

> [!IMPORTANT]
> **Le nom de code du DÉPÔT n'est pas forcément celui de la machine.** MongoDB ne
> publie que pour les distributions qu'il prend en charge : il n'existe par
> exemple **aucun dépôt `trixie`** (Debian 13). `$VERSION_CODENAME` donnerait
> `trixie`, et `apt update` répondrait **404** sur une URL qui n'a jamais existé
> — sans dire qu'il faut reculer d'une version. Sur Debian 13, utiliser le dépôt
> **`bookworm`** (fonctionne : `mongodb-org 8.0.x`). Vérifier les versions
> publiées sur `https://repo.mongodb.org/apt/debian/dists/` avant d'installer.

```bash
# Debian 12 (bookworm) — et Debian 13 (trixie) : dépôt bookworm aussi
apt-get install -y gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc \
  | gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] \
https://repo.mongodb.org/apt/debian bookworm/mongodb-org/8.0 main" \
  > /etc/apt/sources.list.d/mongodb-org-8.0.list
apt-get update && apt-get install -y mongodb-org
systemctl enable --now mongod
```

<details><summary>Variante Ubuntu</summary>

```bash
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] \
https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" \
  > /etc/apt/sources.list.d/mongodb-org-8.0.list
```

`jammy` (22.04) ou `noble` (24.04) selon ce que MongoDB publie — même règle : le
nom de code du DÉPÔT, pas celui de la machine.

</details>

> [!CAUTION]
> **Ne pas « mettre à jour » la prod en changeant simplement de dépôt.** Le VPS
> actuel est en **8.0** ; passer à une version majeure supérieure sur des
> données existantes impose une montée **une version majeure à la fois**, avec `setFeatureCompatibilityVersion`
> et une **sauvegarde** (`mongodump`) avant. Le bloc ci-dessus est pour une
> installation neuve.

Vérifier avant d'aller plus loin — un `mongod` qui ne démarre pas se voit ici,
pas trois étapes plus tard :

```bash
systemctl is-active mongod && mongosh --quiet --eval 'db.runCommand({ping:1})'
```

**b) Configuration** — `nano /etc/mongod.conf` :

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1 # loopback SEULEMENT — suffit grâce à network_mode: host
security:
  authorization: enabled # exige un utilisateur/mot de passe
```

```bash
systemctl restart mongod
```

**c) Créer les utilisateurs.** Deux, et **l'ordre compte**.

> [!WARNING]
> Avec `authorization: enabled`, MongoDB n'autorise la création sans
> authentification que **depuis la boucle locale et tant qu'aucun utilisateur
> n'existe** (« exception localhost »). Elle se referme dès le premier
> `createUser`. Ne créer que l'utilisateur applicatif — qui n'a aucun droit
> d'administration — et plus personne ne peut ajouter un compte, changer un mot
> de passe ni accorder un rôle.
>
> Rattrapable, mais avec une coupure : arrêter `mongod`, passer
> `authorization: disabled` (la base reste en `bindIp: 127.0.0.1`, donc
> invisible de l'extérieur pendant l'opération), redémarrer, créer
> l'administrateur, remettre `enabled`, redémarrer.

> [!NOTE]
> **`monetoile_dbadmin`, et pas `admin`.** Dans ce projet, `ADMIN` et
> `SUPER_ADMIN` sont déjà des **rôles applicatifs** : des comptes de la
> plateforme, créés par `make vps-seed-admins` (`SUPER_ADMIN_*` dans
> `.env.production`), qui se connectent au back-office. Rien à voir avec un
> compte MongoDB. Deux « admin » dans la même installation, et c'est le mauvais
> mot de passe qu'on va chercher — ou le mauvais qu'on révoque.

```bash
mongosh
```

```javascript
// 1. L'administrateur de la BASE — celui qui pourra encore agir demain.
use admin
db.createUser({
  user: "monetoile_dbadmin",
  pwd: passwordPrompt(),                  // saisie masquée, pas dans l'historique
  roles: [ { role: "userAdminAnyDatabase", db: "admin" },
           { role: "readWriteAnyDatabase", db: "admin" } ]
})

// 2. L'utilisateur applicatif — droits bornés à SA base, créé DANS cette base
//    (d'où authSource=monetoile dans l'URI, comme la prod actuelle).
db.auth("monetoile_dbadmin", passwordPrompt())
use monetoile
db.createUser({
  user: "monetoile_app",
  pwd: passwordPrompt(),
  roles: [ { role: "readWrite", db: "monetoile" } ]   // ⚠️ nom EXACT de la base de l'URI
})
exit
```

> [!IMPORTANT]
> Le rôle porte le **nom de la base**, pas un motif. `readWrite` sur `monetoile`
> ne donne **aucun** droit sur `mon-etoile` ni sur `monetoile-prod` : l'API
> démarre, puis échoue à la première opération sur `not authorized`, sans nommer
> la cause. Ce nom doit être **exactement** le segment de chemin de
> `MONGODB_URI`.
>
> `passwordPrompt()` plutôt qu'un mot de passe dans la commande : `mongosh`
> garde un historique (`~/.mongodb/mongosh/`), et un mot de passe collé y reste
> en clair.

Sur la prod existante, vérifier qu'un compte d'administration **existe et que
quelqu'un en a le mot de passe** (sinon : procédure de rattrapage ci-dessus,
avant d'en avoir besoin en urgence) :

```bash
mongosh -u monetoile_dbadmin -p --authenticationDatabase admin \
  --eval 'db.adminCommand({ usersInfo: { forAllDBs: true } }).users.map(u => `${u.db}.${u.user}`)'
```

**d) Pare-feu : rien à ouvrir.** `bindIp: 127.0.0.1` suffit à rendre 27017
injoignable depuis internet, et le conteneur passe par la boucle locale. Un
`ufw deny 27017/tcp` est inoffensif ici (défense en profondeur), contrairement à
une configuration bridge (cf. NOTE en tête d'étape). Vérifier **depuis ton
poste** que le port est bien fermé :

```bash
nc -vz -w 3 51.210.42.70 27017   # doit ÉCHOUER (refusé ou expiré)
```

**e) Vérifier que l'authentification mord vraiment.** Un
`authorization: enabled` mal appliqué (faute d'indentation YAML, `mongod` pas
redémarré) laisse la base ouverte, et rien ne le dit :

```bash
mongosh --quiet --eval 'db.getSiblingDB("monetoile").getCollectionNames()' && \
  echo "❌ LECTURE SANS AUTHENTIFICATION — la base est ouverte" || \
  echo "✅ refusé sans authentification"
mongosh -u monetoile_app -p --authenticationDatabase monetoile \
  --eval 'db.getSiblingDB("monetoile").runCommand({ping:1})'
```

Puis, depuis ton poste, le test de bout en bout avec le vrai `.env.production` :

```bash
make vps-db-ping
```

`.env.production` (topologie B) :

```ini
MONGODB_URI=mongodb://monetoile_app:MDP-ENCODÉ@localhost:27017/monetoile?authSource=monetoile
```

#### Topologie C — MongoDB sur un autre serveur, via tunnel SSH

La base vit sur **un autre serveur** et n'est **pas ouverte sur internet**. C'est
exactement le **« SSH Tunnel » de MongoDB Compass** (un SSH vers un hôte, un port
local redirigé, Mongo joint à travers) — sauf qu'ici c'est le **VPS** qui le
tient, en permanence. Le trafic voyage **chiffré** dans SSH, rien n'est publié.

Grâce à `network_mode: host`, l'entrée du tunnel écoute simplement sur
**`127.0.0.1` du VPS** : pas de passerelle Docker à trouver. Port local
**`27018`** pour ne pas entrer en collision avec un éventuel `mongod` local
(topologie B) sur 27017.

Trois repères à renseigner : `HOTE_SSH` (serveur joignable en SSH), `HOTE_MONGO`
(Mongo **vu depuis `HOTE_SSH`** — `127.0.0.1` s'il tourne sur ce même serveur,
une IP privée si `HOTE_SSH` est un bastion), `PORT_MONGO` (souvent `27017`).

**a) Sur le serveur Mongo distant** : Mongo en `bindIp: 127.0.0.1` +
`authorization: enabled` (mêmes utilisateurs qu'en B, étape c), et un compte SSH
dédié, **par clé**, borné à la redirection — dans son `authorized_keys` :

```text
restrict,port-forwarding,permitopen="HOTE_MONGO:PORT_MONGO" ssh-ed25519 AAAA... tunnel-monetoile
```

(`restrict` coupe shell, agent, X11 ; `permitopen` n'autorise que CE port.)

**b) Sur le VPS** (en `root`) : autossh, clé privée pour `apimanager`, empreinte
de l'hôte distant **figée** (pas de confiance aveugle à la 1ʳᵉ connexion), service
systemd.

```bash
apt install -y autossh
# Clé privée d'accès au serveur SSH → /home/apimanager/.ssh/id_mongo
chmod 600 /home/apimanager/.ssh/id_mongo && chown apimanager:apimanager /home/apimanager/.ssh/id_mongo
sudo -u apimanager sh -c 'ssh-keyscan -H HOTE_SSH >> ~/.ssh/known_hosts'   # fige l'empreinte
nano /etc/systemd/system/mongo-tunnel.service
```

```ini
[Unit]
Description=Tunnel SSH vers MongoDB externe (chiffré, non exposé)
After=network-online.target
Wants=network-online.target

[Service]
User=apimanager
Environment=AUTOSSH_GATETIME=0
# Entrée locale 127.0.0.1:27018 → HOTE_MONGO:PORT_MONGO (vu depuis HOTE_SSH).
ExecStart=/usr/bin/autossh -M 0 -N \
  -o ServerAliveInterval=15 -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes -o StrictHostKeyChecking=yes \
  -L 127.0.0.1:27018:HOTE_MONGO:PORT_MONGO \
  -i /home/apimanager/.ssh/id_mongo UTILISATEUR_SSH@HOTE_SSH
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now mongo-tunnel
systemctl status mongo-tunnel       # doit être "active (running)"
ss -ltn | grep 27018                # doit écouter sur 127.0.0.1 SEULEMENT
```

`.env.production` (topologie C) :

```ini
MONGODB_URI=mongodb://monetoile_app:MDP-ENCODÉ@127.0.0.1:27018/monetoile?authSource=monetoile&directConnection=true
```

> [!WARNING]
> **Replica set : `directConnection=true` est obligatoire** à travers un tunnel
> vers un seul nœud. Sans lui, le driver découvre les autres membres (noms
> d'hôtes internes) et tente de les joindre **hors tunnel** →
> `Server selection timed out`. Joindre plusieurs membres demande un tunnel par
> membre — rare, préférer `directConnection`.
>
> Pas de TLS à ajouter : SSH chiffre déjà le transport. Si le serveur **impose**
> TLS, ajouter `&tls=true&tlsAllowInvalidHostnames=true` (le certificat porte le
> nom du serveur, pas `127.0.0.1`).

> Variante **réseau privé** (Mongo joignable par une IP privée, jamais par
> internet) : pas de tunnel —
> `MONGODB_URI=mongodb://monetoile_app:MDP-ENCODÉ@<ip-privée>:27017/monetoile?authSource=monetoile`
> (+ `&tls=true` s'il exige TLS).

> [!CAUTION]
> **Dans tous les cas : ne jamais publier 27017 sur internet.** Et attention :
> un port publié par Docker (`ports: - "27017:27017"`) **contourne ufw** — Docker
> écrit ses propres règles iptables avant celles d'ufw. Un `ufw deny 27017` ne
> protège donc **pas** un Mongo conteneurisé exposé ainsi.

---

### Étape 1 ter — Deux comptes, deux rôles

| Compte       | Rôle               | Droits                                             |
| ------------ | ------------------ | -------------------------------------------------- |
| `debian`     | **administration** | groupe `sudo` — Caddy, ufw, mongod, systemd        |
| `apimanager` | **déploiement**    | groupe `docker` seulement, **pas de sudo** (voulu) |

`apimanager` n'a besoin que de piloter des conteneurs ; lui donner sudo
l'étendrait à toute la machine, alors que sa clé vit sur les postes de dev.

Conséquence : **tout ce qui exige root s'exécute SUR le VPS**, dans une session
`debian` où l'on saisit le mot de passe sudo. Ces actions sont des **scripts
versionnés**, livrés avec le code dans `deployment/scripts/` :

| Depuis ton poste      | Ce que ça fait                                     | Root ? |
| --------------------- | -------------------------------------------------- | ------ |
| `make caddy-check`    | diff + validation du Caddyfile, n'écrit rien       | non    |
| `make caddy-sync`     | applique le Caddyfile (bloc géré) + recharge Caddy | oui    |
| `make firewall-check` | montre les règles ufw qui seraient posées          | non    |
| `make firewall`       | pose les règles ufw (22/80/443, ferme 3000/3001)   | oui    |
| `make ssh-admin`      | ouvre une session `debian` (pour lancer `sudo …`)  | —      |

Pour une cible « root » : si ta clé est autorisée pour `debian` (`VPS_ADMIN`),
`make` ouvre la session et `sudo` te demande le mot de passe **sur le VPS** ;
sinon `make` affiche la commande exacte à lancer après
`ssh debian@51.210.42.70` :

```bash
sudo /opt/mon-etoile-backend/deployment/scripts/caddy-sync.sh
sudo /opt/mon-etoile-backend/deployment/scripts/firewall.sh
```

> [!NOTE]
>
> - `make ssh` ouvre une session **`apimanager`** : inutile pour tout ce qui
>   demande root → `make ssh-admin` ;
> - `make` n'est pas installé sur le VPS : les cibles se lancent depuis ton
>   poste ; sur le VPS, on appelle directement les scripts ;
> - ces cibles font d'abord `make pull` : c'est la version **poussée** sur
>   `origin/main` du script et du Caddyfile qui est utilisée.

---

### Étape 2 — Créer l'utilisateur dédié `apimanager`

Faire tourner des applications en root est dangereux. Nous créons un utilisateur système isolé.

Toujours en `root` sur le VPS :

```bash
# Créer l'utilisateur (sans mot de passe direct, connexion par clé uniquement)
adduser --disabled-password --gecos "" apimanager

# L'autoriser à piloter Docker sans sudo
usermod -aG docker apimanager

# Créer le répertoire de l'app (sous /opt) et lui donner la propriété
mkdir -p /opt/mon-etoile-backend
chown apimanager:apimanager /opt/mon-etoile-backend
```

---

### Étape 3 — Clé SSH n°1 : ton ordinateur → le VPS

Cette clé permet à `make` (depuis ton ordinateur) de se connecter au VPS sans mot de passe.
Par défaut, le Makefile utilise ta clé standard **`~/.ssh/id_ed25519`**.

**Sur ton ordinateur** (dans un terminal local) :

- Si tu as déjà une clé `id_ed25519` (déjà présente sous `~/.ssh/id_ed25519`), tu peux sauter la génération et simplement afficher la clé publique.
- Sinon, génère-la :

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
```

Affiche ta clé publique pour la copier :

```bash
cat ~/.ssh/id_ed25519.pub      # Copie la ligne affichée (commence par ssh-ed25519 …)
```

**Sur le VPS**, en tant que `root` :

```bash
mkdir -p /home/apimanager/.ssh
chmod 700 /home/apimanager/.ssh
echo "COLLE-LA-LIGNE- ssh-ed25519-..." >> /home/apimanager/.ssh/authorized_keys
chmod 600 /home/apimanager/.ssh/authorized_keys
chown -R apimanager:apimanager /home/apimanager/.ssh
```

Vérifie la connexion depuis ton ordinateur :

```bash
ssh -i ~/.ssh/id_ed25519 apimanager@51.210.42.70
# Tu dois te connecter sans mot de passe. Tape exit pour quitter.
```

---

### Étape 4 — Clé SSH n°2 : le VPS → le dépôt Git (Deploy Key)

Le VPS doit lire ton code privé depuis le dépôt. Une seule commande génère sa
clé sur le VPS et l'affiche (elle ajoute aussi la clé d'hôte du serveur Git) :

```bash
make vps-key
```

> [!NOTE]
> `make vps-key` est **ré-exécutable sans risque** : si la clé du VPS
> (`~/.ssh/id_ed25519`) n'existe pas encore, elle la crée ; si elle existe déjà,
> elle se contente de la ré-afficher. Lance-la que ce soit ta première
> installation ou non.

Copie la clé publique affichée entre les lignes `=====`, puis suis **la version
qui correspond à ton hébergeur** ci-dessous.

#### Version A — GitLab

**Si ce n'est pas encore fait** (clé jamais ajoutée à ce dépôt) — sur GitLab :
**Projet ▸ Settings ▸ Repository ▸ Deploy keys ▸ Add key**. Colle la clé,
nomme-la `VPS`, laisse en **lecture seule** et valide.

**Si c'est déjà fait** (clé déjà ajoutée à un autre dépôt du même VPS) — pas
besoin de la recréer : dans **Deploy keys**, onglet des clés déjà disponibles,
**active** la clé existante en un clic.

> [!TIP]
> C'est le **même VPS** pour le backend et le frontend → la **même** clé sert
> aux deux projets. C'est ce qui rend l'activation en un clic possible côté
> frontend une fois la clé ajoutée au backend.

Dans l'Étape 5, l'URL SSH du dépôt est de la forme :

```env
REPO_URL=git@gitlab.com:dss-civ/monetoilebackend.git
```

#### Version B — GitHub

**Si ce n'est pas encore fait** — sur GitHub : **Repo ▸ Settings ▸ Deploy keys ▸
Add deploy key**. Colle la clé, titre `VPS`, laisse **« Allow write access »
décoché** (lecture seule) et valide.

**Si la clé du VPS est déjà utilisée sur un autre dépôt GitHub** (ex. le
backend) — tu **ne peux pas** la réutiliser ici : génère une clé dédiée à ce
dépôt (voir WARNING ci-dessous), ajoute-la via **Add deploy key**, puis route ce
dépôt vers elle.

> [!WARNING]
> GitHub **refuse la même Deploy Key sur deux dépôts** (« Key is already in
> use »). Or `make vps-key` crée une **seule** clé (`~/.ssh/id_ed25519`) sur le
> VPS. Contrairement à GitLab, tu **ne peux donc pas** réutiliser la même clé
> pour le backend et le frontend. Trois options :
>
> - une **Deploy Key distincte par dépôt** — générer une 2ᵉ clé sur le VPS
>   (`ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_front -N ""`) et l'ajouter au
>   dépôt frontend, **ou**
> - un **compte machine** (machine user) ayant accès aux deux dépôts, **ou**
> - un **Personal Access Token** en HTTPS au lieu d'une Deploy Key SSH.

> [!NOTE]
> `make vps-key` ajoute automatiquement la **bonne** clé d'hôte au VPS : elle est
> déduite de `REPO_URL` (variable `GIT_HOST` du Makefile). Si `REPO_URL` pointe
> sur `github.com`, la clé d'hôte `github.com` est ajoutée toute seule — **rien
> à modifier** dans le `Makefile`.

Dans l'Étape 5, l'URL SSH du dépôt devient :

```env
REPO_URL=git@github.com:ysprod/monetoilebackend.git
```

> [!NOTE]
> Le comment de la clé est `apimanager@dss-vps` (généré automatiquement par
> `make vps-key`) — juste une étiquette, sans effet sur l'authentification.

---

### Étape 5 — Configurer la télécommande (`.env` local)

Sur **ton ordinateur**, dans le fichier `monetoilebackend/.env` (créé par `make install`), ajoute ou modifie ces lignes :

```env
VPS_USER=apimanager
VPS_HOST=51.210.42.70
APP_DIR=/opt/mon-etoile-backend
REPO_URL=git@gitlab.com:dss-civ/monetoilebackend.git  # URL SSH — GitLab OU GitHub (voir ci-dessous)
SSH_KEY=$(HOME)/.ssh/id_ed25519
VPS_ADMIN=debian    # compte d'administration (sudo) — make caddy-sync / firewall / ssh-admin
```

> [!IMPORTANT]
> **C'est `REPO_URL` qui décide de l'hébergeur d'où le code est récupéré.** Les
> targets `make setup` et `make pull` font `git ... $(REPO_URL)`, et le Makefile
> charge ce `.env` (`-include .env`) → ta valeur **écrase** le défaut GitLab.
> Mets l'URL **SSH** selon ton cas :
>
> - GitLab : `REPO_URL=git@gitlab.com:dss-civ/monetoilebackend.git`
> - GitHub : `REPO_URL=git@github.com:ysprod/monetoilebackend.git`
>
> ✅ **`REPO_URL` suffit** : le Makefile en déduit automatiquement la clé d'hôte
> à ajouter au VPS (variable `GIT_HOST` → `ssh-keyscan`), donc **aucun autre
> réglage** pour passer de GitLab à GitHub. Il reste seulement à poser la Deploy
> Key sur le bon hébergeur (Étape 4).

---

### Étape 6 — Première mise en ligne (setup)

1. Sur **ton ordinateur**, configure le fichier `.env.production` à la racine de `monetoilebackend/` avec les vraies clés de prod (MongoDB locale, clé Deepseek, RayMoney, etc.).
2. Pousse-le sur le VPS :
   ```bash
   make env-push
   ```
3. Initialise le projet sur le serveur (récupération du code via git, build de l'image Docker, démarrage des conteneurs API + worker) :
   ```bash
   make setup
   ```
   `make setup` est **ré-exécutable** : il recale toujours le code sur `origin/main`. Prérequis : la Deploy Key (Étape 4) doit être ajoutée sur GitLab, sinon la récupération du code échoue (`Permission denied`).
   Si l'API ne devient pas saine, **tester la base d'abord** : `make vps-db-ping` (cf. [Étape 1 bis](#étape-1-bis--mongodb--préparer-la-base)).
   Les conteneurs ont `restart: always` — ils redémarrent seuls s'ils plantent ou au reboot du VPS (assure-toi que Docker démarre au boot : `sudo systemctl enable docker`). Aucune config PM2 nécessaire.
4. Charge les données et le compte admin initiaux **en production**. Le Mongo de
   prod tourne sur le VPS (localhost de l'hôte) → **injoignable depuis ton poste**.
   On exécute donc le seed **dans le conteneur** (il a `MONGODB_URI` +
   `SUPER_ADMIN_*` via `env_file`), piloté par SSH depuis ton poste :
   ```bash
   make vps-seed          # grades spirituels
   ```
   ```bash
   make vps-seed-admins   # crée le SUPER_ADMIN (RESET=1 pour réinitialiser son mdp)
   ```
   > Les scripts sont compilés dans l'image (`dist/scripts/`, cf. `Dockerfile`) et
   > lancés via `docker compose exec` — pas besoin de ts-node dans le conteneur.
   > `make seed` / `make seed-admins` (sans `vps-`) visent, eux, ta base **locale**.

---

### Étape 7 — Accès par IP (pas de domaine pour l'instant)

> [!WARNING]
> **Mode legacy, incompatible avec la config actuelle.** L'API tourne en
> `network_mode: host` (pour joindre le Mongo natif du VPS) et son port 3001 est
> **fermé au public par ufw** ; le front tourne aussi en `network_mode: host` (3000,
> fermé lui aussi). L'accès direct `http://IP:3001` / `http://IP` ne fonctionne
> donc **plus** — le domaine servi par **Caddy** (Étape 7 bis) est le mode nominal.

Tant qu'il n'y a pas de nom de domaine, on accède directement par l'IP du VPS,
sans HTTPS. Les conteneurs exposent leurs ports sur l'hôte :

- **API** : `http://51.210.42.70:3001` (port `API_PORT` du `.env.production`)
- **Frontend** : `http://51.210.42.70` (port 80 — `WEB_PORT=80` du `.env.production` du front)

> [!IMPORTANT]
> En accès HTTP par IP, les cookies de session ne sont **pas** `Secure`. Le
> `.env.production` doit contenir :
>
> ```env
> BASE_URL=http://51.210.42.70:3001
> FRONTEND_URL=http://51.210.42.70
> AUTH_COOKIE_SECURE=false
> AUTH_COOKIE_SAMESITE=lax
> AUTH_COOKIE_DOMAIN=            # vide (cookie lié à l'IP)
> ```

> [!NOTE]
> **Paiement RayMoney** : RayMoney exige un `callback_url` HTTPS, qui n'existe
> pas en accès par IP. Le callback n'arrivera donc pas — mais la **réconciliation
> par polling** (le front interroge l'API qui vérifie l'état auprès de RayMoney)
> confirme quand même les paiements. Rien à faire de plus.

Quand tu auras un domaine, passe à l'Étape 7 bis (Caddy + HTTPS).

---

### Étape 7 bis — Domaine + HTTPS (via Caddy)

Avec **monetoile.org** (zone DNS chez LWS : enregistrements `A` de l'apex et de
`www` → `51.210.42.70`), c'est **Caddy**, installé nativement sur le VPS, qui
termine le TLS (certificats Let's Encrypt obtenus et renouvelés tout seuls) et
route par chemin :

- `https://monetoile.org/` → frontend `127.0.0.1:3000`
- `https://monetoile.org/api/v1`, `/api/v1/*`, `/socket.io/*`, `/uploads/*` → API `127.0.0.1:3001`
- `https://www.monetoile.org` → redirection permanente vers l'apex

L'API + le worker tournent en `network_mode: host` : l'API écoute sur l'hôte en
`3001`, Caddy la joint en `127.0.0.1:3001`. Elle n'est pas exposée directement
(Caddy = seul point d'entrée public, 80/443).

**1. `.env.production` en mode domaine** (déjà appliqué dans ce repo) :

```env
BASE_URL=https://monetoile.org
FRONTEND_URL=https://monetoile.org
PUBLIC_UPLOAD_URL=https://monetoile.org/uploads
AUTH_COOKIE_SECURE=true          # HTTPS → cookie Secure
AUTH_COOKIE_SAMESITE=lax
AUTH_COOKIE_DOMAIN=              # vide = lié à monetoile.org
```

Applique-le : `make env-push && make deploy`.

**2. Caddyfile** — versionné dans
**[`deployment/caddy/Caddyfile`](deployment/caddy/Caddyfile)**, appliqué par
[`deployment/scripts/caddy-sync.sh`](deployment/scripts/caddy-sync.sh) (bloc
géré, validé avant installation, sauvegarde + retour arrière automatique) :

```bash
make caddy-check     # diff + validation, sans root
make caddy-sync      # applique (root — cf. Étape 1 ter)
make caddy-test      # curl HTTPS + /api/v1
```

Ou directement sur le VPS, dans une session `debian` :

```bash
sudo /opt/mon-etoile-backend/deployment/scripts/caddy-sync.sh
```

> [!WARNING]
> **Ne jamais lancer `caddy validate` en root à la main** : il crée
> `/var/log/caddy/monetoile.log` au nom de root, et Caddy (user `caddy`) refuse
> ensuite de démarrer (`permission denied`). Le script valide en tant que
> `caddy`. Si c'est arrivé : `sudo chown caddy:caddy /var/log/caddy/*.log`.

> [!NOTE]
> **`/api/v1` exact est routé vers l'API** (pas seulement `/api/v1/*`) : sinon
> ce chemin tombe sur le front, dont le rewrite Next le renvoie vers
> `https://monetoile.org/api/v1` → boucle jusqu'au timeout.

> [!NOTE]
> **RayMoney** : en HTTPS, le `callback_url` (`https://monetoile.org/api/v1/...`)
> est enfin valide → le callback arrive directement (plus seulement le polling).

---

### Étape 8 — Activer le Pare-feu

Sur le VPS (en root / sudo), n'ouvrir que le nécessaire. **Autoriser SSH AVANT
`enable`**, sinon on se coupe l'accès (secours : console KVM de l'hébergeur) :

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # Caddy : HTTP → HTTPS + challenge Let's Encrypt
sudo ufw allow 443/tcp     # Caddy : HTTPS
sudo ufw allow 443/udp     # Caddy : HTTP/3
sudo ufw show added        # relire AVANT d'activer
sudo ufw enable
```

Équivalent piloté : `make firewall-check` (montre) puis `make firewall`
(applique, root) — ou sur le VPS :
`sudo /opt/mon-etoile-backend/deployment/scripts/firewall.sh`
(ajouter `--enable` pour activer ufw s'il est inactif).
Les ports 3000 (front) et 3001 (API) ne sont **pas** ouverts : Caddy les joint
en local.

> [!CAUTION]
> ufw **ne protège pas** les ports publiés par Docker (`ports:` d'un conteneur
> en bridge) : Docker écrit ses règles iptables avant celles d'ufw. Sur ce VPS,
> Redis (6379) et d'autres services conteneurisés restent donc joignables même
> ufw actif — seuls leurs mots de passe les protègent.

---

## Mises à jour suivantes (deploy)

Pour déployer ton code local une fois que tu as fait un `git commit` :

```bash
make deploy
```

La commande pousse le code sur GitLab, ordonne au VPS de le récupérer, reconstruit l'image Docker puis recrée le conteneur (quelques secondes de coupure : en `network_mode: host`, une seule instance peut tenir le port 3001 — cf. `deployment/scripts/deploy.sh`).

Si tu as modifié uniquement le `.env.production` local :

```bash
make env-push && make restart
```

---

## Variables d'environnement

| Variable                          | Usage                                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                        | Mode de l'app (`production` ou `development`)                                                                          |
| `PORT` / `BASE_URL`               | Port local de l'API (3001) / Son URL publique (`https://monetoile.org`)                                                |
| `MONGODB_URI`                     | Connexion MongoDB, base incluse (`/monetoile`) — formes A/B/C : [Étape 1 bis](#étape-1-bis--mongodb--préparer-la-base) |
| `REDIS_HOST` / `REDIS_PORT`       | Hôte et port (6379) du Redis du VPS (conteneur `redis`, mot de passe `REDIS_PASSWORD`)                                 |
| `JWT_SECRET`                      | Secret de chiffrement des tokens de session (générer une clé forte)                                                    |
| `DEEPSEEK_API_KEY`                | Clé API pour la génération des analyses par l'IA                                                                       |
| `RAYMONEY_KEY` / `RAYMONEY_TOKEN` | Clés marchandes pour les paiements d'offrandes par Mobile Money                                                        |

---

## Dépannage et maintenance

Toutes les commandes se lancent depuis **ton ordinateur** :

- **Voir les conteneurs** : `make status` (docker compose ps)
- **Consulter les logs de l'API** : `make logs`
- **Consulter les logs du worker** : `make logs-worker`
- **Tester MongoDB depuis le VPS** : `make vps-db-ping` (même si l'API boucle au démarrage)
- **Redémarrer les services** : `make restart`
- **Accéder au terminal VPS** : `make ssh` (`apimanager`) — session d'administration (sudo) : `make ssh-admin`

---

_Jésus est Seigneur et Sauveur — HonorIT_
