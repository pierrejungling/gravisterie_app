# API La Gravisterie (NestJS)

Backend de l'application de gestion La Gravisterie : commandes, clients, fichiers (R2), authentification JWT.

## Installation

```bash
npm install
cp .env.example .env
# Éditer .env avec vos valeurs (DB, JWT, R2, WEBHOOK_SECRET)
```

## Lancement

```bash
npm run start:dev    # développement (watch)
npm run start:prod   # production
```

API par défaut : `http://localhost:2023/api`

## Variables d'environnement

Voir `.env.example`. Variables importantes :

| Variable | Description |
|---|---|
| `APP_PORT` | Port du serveur (ex. `2023`) |
| `APP_BASE_URL` | Préfixe global des routes (ex. `/api`) |
| `DB_*` | Connexion PostgreSQL |
| `JWT_*` | Secrets et durées des tokens |
| `WEBHOOK_SECRET` | Secret partagé avec le site vitrine (header `x-webhook-secret`) |
| `R2_*` | Stockage Cloudflare R2 pour les pièces jointes des commandes |

Générer un secret webhook :

```bash
openssl rand -hex 32
```

## Webhook — création automatique de commandes depuis le site vitrine

Lorsqu'un visiteur soumet un formulaire sur [gravisterie.be](https://www.gravisterie.be), les scripts PHP (`send-mail.php`, `send-order.php`) envoient les données à l'API **en plus** de l'email de notification. Une commande est créée automatiquement dans l'app de gestion.

### Endpoint

```
POST /api/orders/webhook
```

- **Authentification** : header `x-webhook-secret` (valeur = `WEBHOOK_SECRET` dans le `.env`)
- **Public** : pas de JWT (décorateur `@Public()`)
- **Content-Type** : `multipart/form-data` (champs texte + fichiers)
- **Réponses** :
  - `201` — commande créée
  - `401` — secret invalide ou absent
  - `400` — validation échouée (email obligatoire)

### Champs du formulaire (multipart)

| Champ | Obligatoire | Description |
|---|---|---|
| `email` | oui | Email du client |
| `firstname` | non | Prénom |
| `lastname` | non | Nom |
| `phone` | non | Téléphone |
| `street`, `postal`, `city`, `country` | non | Adresse (format stocké : `rue, code postal, ville, pays`) |
| `message` | non | Remarques / message du client |
| `deadline` | non | Deadline (texte libre ou date ISO) |
| `newsletter` | non | `"1"` ou `"0"` |
| `terms` | non | CGV acceptées : `"1"` ou `"0"` |
| `product_name` | non | Produit demandé (uniquement depuis `send-order.php`) |
| `attachments[]` | non | Pièces jointes (tous types, max 50 Mo total, 20 fichiers) |

### Comportement côté API

- **Titre de la commande** : `📫 WEB | Nom Prenom` (fallback sur l'email)
- **Statut initial** : `en_attente_information`
- **Client** : créé ou mis à jour par email
- **Description** : produit (si présent), remarques, deadline, newsletter, CGV
- **Fichiers** : uploadés vers R2 via `CommandeFichierService` (table `commande_fichier`)

### Test local

```bash
curl -X POST http://localhost:2023/api/orders/webhook \
  -H "x-webhook-secret: VOTRE_SECRET" \
  -F "email=test@test.be" \
  -F "firstname=Jean" \
  -F "lastname=Dupont" \
  -F "message=Test webhook" \
  -F "deadline=2026-09-01" \
  -F "newsletter=1" \
  -F "terms=1" \
  -F "attachments[0]=@/chemin/vers/fichier.pdf"
```

### Fichiers concernés

```
src/module/lag/
├── controller/webhook.controller.ts
├── service/commande.service.ts          # creerCommandeDepuisWebhook()
└── model/payload/commande_payload/
    └── create_order_from_webhook.dto.ts
```

Les endpoints existants (`/api/commande/*`) ne sont pas modifiés.

## Déploiement

En production (Render), ajouter `WEBHOOK_SECRET` dans les variables d'environnement **avant** le déploiement. Le secret doit être identique à `GRAVISTERIE_API_WEBHOOK_SECRET` dans les scripts PHP du site vitrine.
