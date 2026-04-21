# Setup de l'environnement

## 1. Cloner le repo

```bash
git clone https://github.com/whispr-messenger/auth-service.git
cd auth-service
```

## 2. Installer les dépendances

```bash
npm install
```

## 3. Configurer l'env

```bash
cp .env.example .env
```

## 4. Base de données

```bash
npm run migration:run
```

## 5. Lancer

```bash
just up dev
```
