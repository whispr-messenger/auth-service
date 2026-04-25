# Flux OTP détaillé

## Inscription

```
Client ──▶ POST /auth/v1/verify/register/request
                │
          Envoi SMS (code 6 chiffres)
                │
Client ──▶ POST /auth/v1/verify/register/confirm
                │
          Vérification code
           ok │ ko
          ┌───┼───┐
          │       │
    Continuer   400 Invalid code
          │
Client ──▶ POST /auth/v1/register
                │
          Création compte + tokens
```

## Connexion

```
Client ──▶ POST /auth/v1/verify/login/request
                │
          Envoi SMS
                │
Client ──▶ POST /auth/v1/verify/login/confirm
                │
Client ──▶ POST /auth/v1/login
                │
          Tokens JWT
```
