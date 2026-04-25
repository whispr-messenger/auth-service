# Logging

## Intercepteur

Le `LoggingInterceptor` trace toutes les requêtes HTTP entrantes.

```
Requête entrante
     │
     ▼
┌──────────────┐
│ Log: method  │
│ url, status  │
│ duration     │
└──────────────┘
     │
     ▼
Réponse
```

Les logs incluent le correlation ID pour le tracing inter-services.
