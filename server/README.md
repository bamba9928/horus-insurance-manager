# Horus Server

Backend multi-utilisateurs de Horus Assurances Manager. Chaque compte
utilisateur possède **sa propre base SQLite** (`data/tenants/user_<id>.db`),
créée avec le même schéma que l'application desktop — isolation des données
par construction.

## Démarrage

```bash
pnpm install
pnpm dev          # développement (rechargement auto)
pnpm start        # production
pnpm test         # tests d'intégration
pnpm typecheck    # vérification TypeScript
```

Au **premier démarrage**, le compte super admin est créé automatiquement.
Sans `ADMIN_PASSWORD`, un mot de passe aléatoire est généré et affiché
**une seule fois** dans la console.

## Variables d'environnement

| Variable         | Défaut   | Rôle                                            |
| ---------------- | -------- | ----------------------------------------------- |
| `PORT`           | `3000`   | Port HTTP                                       |
| `DATA_DIR`       | `./data` | Répertoire des bases (admin.db + tenants/)      |
| `ADMIN_LOGIN`    | `admin`  | Ancien login du super admin à récupérer si la base existe déjà |
| `ADMIN_EMAIL`    | —        | Email utilisé pour se connecter comme super admin |
| `ADMIN_CONTACT_EMAIL` | `ADMIN_EMAIL` | Email de contact affiché aux comptes à activer |
| `ADMIN_PASSWORD` | —        | Mot de passe du super admin (sinon généré)      |
| `ALLOW_REGISTRATION` | `true` | Active/désactive l'auto-inscription publique |
| `NODE_ENV`       | —        | `production` active le cookie `Secure` (HTTPS)  |
| `COOKIE_SECURE`  | —        | Force le cookie `Secure` (`true`/`false`) — prioritaire sur `NODE_ENV` |
| `STATIC_DIR`     | —        | Répertoire du frontend web à servir (absent = API seule) |

## API

| Méthode | Route                          | Accès       | Rôle                                      |
| ------- | ------------------------------ | ----------- | ----------------------------------------- |
| GET     | `/api/health`                  | public      | Sonde de vie                              |
| POST    | `/api/auth/login`              | public      | Connexion (rate-limité : 10 échecs/15 min) |
| POST    | `/api/auth/logout`             | connecté    | Déconnexion                               |
| GET     | `/api/me`                      | connecté    | Utilisateur courant                       |
| GET     | `/api/admin/users`             | super admin | Liste des comptes                         |
| POST    | `/api/admin/users`             | super admin | Créer un compte (+ sa base métier)        |
| POST    | `/api/admin/users/:id/password`| super admin | Réinitialiser un mot de passe             |
| POST    | `/api/admin/users/:id/active`  | super admin | Suspendre / réactiver un compte           |

### API métier (toutes derrière session, scellées au tenant)

- Clients : `GET/POST /api/clients`, `GET /api/clients/count`, `GET/PATCH/DELETE /api/clients/:id`
- Véhicules : `GET/POST /api/vehicules`, `GET/PATCH/DELETE /api/vehicules/:id`
- Assureurs : `GET/POST /api/assureurs`, `PATCH/DELETE /api/assureurs/:id`
- Intégrations : `GET /api/integrations/overview`, `GET /api/integrations/logs`, `POST /api/integrations/:id/test`
- Polices : `GET/POST /api/polices`, `GET/PATCH/DELETE /api/polices/:id`, `POST /api/polices/:id/renew`
- Paiements : `GET/POST /api/paiements`, `PATCH/DELETE /api/paiements/:id`
- Dossier complet : `POST /api/dossiers`
- Dashboard : `GET /api/dashboard/{kpi,echeances30j,echeances-range,impayes,recap}`
- Sauvegarde : `GET /api/backup`, `POST /api/restore`
- Vérification : `GET /api/verify/:immatriculation`

Sessions par cookie `httpOnly` (7 jours, glissants). Mots de passe hachés en
argon2id. Aucune auto-inscription : seul le super admin crée les comptes.

## Déploiement Docker

Depuis la racine du dépôt (le Dockerfile construit le frontend web *et* le
serveur, puis les sert ensemble) :

```bash
cp .env.example .env          # renseigner DOMAIN + ADMIN_PASSWORD
docker compose up -d --build
docker compose logs app       # récupérer le mot de passe admin si généré
```

Caddy gère le HTTPS automatiquement (Let's Encrypt) pour `DOMAIN`. Les données
sont dans le volume `horus-data` (à sauvegarder). Le frontend est buildé en
mode `VITE_API_MODE=http` et servi par le serveur (`STATIC_DIR=/app/public`).

### Variante : VPS qui héberge déjà d'autres sites (nginx existant)

Si le VPS a déjà un nginx qui écoute sur 80/443 pour d'autres domaines,
ne pas lancer Caddy (conflit de port). Utiliser `docker-compose.shared-nginx.yml` :
l'app écoute uniquement sur `127.0.0.1:3010`, jamais exposée directement.

```bash
cp .env.example .env          # renseigner ADMIN_PASSWORD (DOMAIN inutile ici)
docker compose -f docker-compose.shared-nginx.yml up -d --build
```

Puis ajouter un site nginx dédié (nouveau fichier, sans toucher aux sites
existants) et un certificat, par exemple `/etc/nginx/sites-available/assur-manager` :

```nginx
server {
    listen 80;
    server_name assur-manager.pro;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/assur-manager /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d assur-manager.pro
```

## Sauvegarde

Tout l'état vit dans `DATA_DIR` : sauvegarder ce répertoire suffit
(admin.db + un fichier .db par utilisateur).

## Importer une base desktop existante

Copier le fichier `assurauto.db` du poste vers
`data/tenants/user_<id>.db` (serveur arrêté). Les migrations manquantes
seront appliquées automatiquement à la première connexion.
