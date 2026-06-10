# App

Ce projet contient une application **Angular** (frontend) et une **API NestJS** (backend), organisées dans deux dossiers :

- **`frontend/`** — Application Angular (générée avec [Angular CLI](https://github.com/angular/angular-cli) 19.2.19)
- **`backend/`** — API NestJS

## Installation

Pour installer toutes les dépendances (frontend et backend), exécutez à la **racine du projet** :

```bash
npm run install:all
```

Ou manuellement :

```bash
cd frontend && npm install
cd ../backend && npm install
```

## Configuration

### Backend (NestJS)

Le fichier `.env` dans le dossier `backend/` doit être configuré avec vos paramètres de base de données et autres variables d'environnement. Voir `backend/.env.example`.

**Important** : Modifiez les valeurs JWT_SECRET pour la production !

**Webhook site vitrine** : définir `WEBHOOK_SECRET` (même valeur que `GRAVISTERIE_API_WEBHOOK_SECRET` dans `send-mail.php` et `send-order.php` du site). Voir [backend/README.md](backend/README.md#webhook--création-automatique-de-commandes-depuis-le-site-vitrine).

### Frontend (Angular)

Les fichiers d'environnement sont dans `frontend/src/environment/` et pointent vers `/api/`, redirigé vers le backend via le proxy.

## Développement

### Lancer les deux projets ensemble

À la racine du projet :

```bash
npm run start:all
```

- Backend (NestJS) : `http://localhost:2023`
- Frontend (Angular) : `http://localhost:4200`

### Lancer séparément

**Frontend uniquement :**
```bash
npm start
# ou
cd frontend && npm start
```

**Backend uniquement :**
```bash
npm run start:api
# ou
cd backend && npm run start:dev
```

Ouvrez ensuite `http://localhost:4200/` dans votre navigateur.

## Build

À la racine :

```bash
npm run build       # frontend uniquement
npm run build:api   # backend uniquement
npm run build:all   # les deux
```

Pour le frontend uniquement depuis son dossier :

```bash
cd frontend && npm run build
```

## Tests

```bash
npm test            # tests Angular (depuis la racine)
cd frontend && npm test
```

## Structure du projet

```
app/
├── frontend/       # Application Angular
│   ├── src/
│   ├── angular.json
│   └── package.json
├── backend/        # API NestJS
│   ├── src/
│   └── package.json
├── package.json    # Scripts racine (start:all, install:all, etc.)
└── README.md
```

## Intégration site vitrine → app de gestion

Les formulaires du site [La Gravisterie](https://www.gravisterie.be) (contact et commande boutique) créent automatiquement une commande dans l'app via un webhook :

1. Le visiteur soumet le formulaire → `send-mail.php` ou `send-order.php`
2. Un email de notification est envoyé à `info@gravisterie.be`
3. En parallèle (best-effort), les données + pièces jointes sont envoyées à `POST /api/orders/webhook`
4. Une commande `📫 WEB | Nom Prenom` apparaît dans le kanban (statut « En attente d'informations »)

Documentation détaillée : [backend/README.md](backend/README.md#webhook--création-automatique-de-commandes-depuis-le-site-vitrine).

## Ressources

- [Angular CLI](https://angular.dev/tools/cli)
- [NestJS](https://nestjs.com/)
