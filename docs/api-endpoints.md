# API Endpoints

Tous les endpoints sont sous le préfixe `/auth/v1/` sauf JWKS (VERSION_NEUTRAL).

## Vérification téléphone

```
POST /auth/v1/verify/register/request
POST /auth/v1/verify/register/confirm
POST /auth/v1/verify/login/request
POST /auth/v1/verify/login/confirm
```

## Authentification

```
POST /auth/v1/register
POST /auth/v1/login
POST /auth/v1/logout
```

## Tokens

```
POST /auth/v1/tokens/refresh
```

## Devices

```
GET /auth/v1/device
DELETE /auth/v1/device/:deviceId
```

## JWKS

```
GET /auth/.well-known/jwks.json
```

Endpoint public (pas de versioning) pour la vérification des tokens JWT.
