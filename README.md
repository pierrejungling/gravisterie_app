# App

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.19.

Ce projet contient à la fois une application Angular (frontend) et une API NestJS (backend).

## Installation

Pour installer toutes les dépendances (Angular et NestJS), exécutez :

```bash
npm run install:all
```

Ou manuellement :

```bash
npm install
cd NestJS && npm install
```

## Configuration

### NestJS

Le fichier `.env` dans le dossier `NestJS/` doit être configuré avec vos paramètres de base de données et autres variables d'environnement. Un fichier `.env` d'exemple a été créé avec les valeurs par défaut.

**Important** : Modifiez les valeurs JWT_SECRET pour la production !

### Angular

Les fichiers d'environnement sont dans `src/environment/` et pointent vers `/api/` qui sera automatiquement redirigé vers le backend NestJS via le proxy.

## Développement

### Lancer les deux projets ensemble

Pour lancer à la fois Angular et NestJS en mode développement :

```bash
npm run start:all
```

Cela lancera :
- NestJS sur `http://localhost:2023`
- Angular sur `http://localhost:4200`

### Lancer séparément

**Angular uniquement :**
```bash
npm start
# ou
ng serve
```

**NestJS uniquement :**
```bash
npm run start:api
# ou
cd NestJS && npm run start:dev
```

Une fois les serveurs lancés, ouvrez votre navigateur et naviguez vers `http://localhost:4200/`. L'application se rechargera automatiquement lorsque vous modifierez les fichiers source.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
