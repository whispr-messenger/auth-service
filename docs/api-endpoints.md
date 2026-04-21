# API Endpoints

## Authentification

### Vérification téléphone

```
POST /auth/phone/verify
```

Envoie un code OTP par SMS au numéro fourni.

### Confirmation du code

```
POST /auth/phone/confirm
```

Vérifie le code OTP et retourne les tokens JWT.

## Tokens

### Rafraîchir un token

```
POST /auth/tokens/refresh
```

Renouvelle l'access token à partir du refresh token.

### Révoquer un token

```
POST /auth/tokens/revoke
```

Révoque un token (logout).

## Devices

### Lister ses appareils

```
GET /auth/devices
```

Retourne la liste des appareils enregistrés pour l'utilisateur.
