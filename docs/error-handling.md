# Gestion des erreurs

## Format de réponse

```json
{
  "statusCode": 400,
  "message": "Invalid verification code",
  "error": "Bad Request"
}
```

## Intercepteur d'erreurs

Toutes les exceptions non gérées sont capturées et formatées en réponse JSON standard.
