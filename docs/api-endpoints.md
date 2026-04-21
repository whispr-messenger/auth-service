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
