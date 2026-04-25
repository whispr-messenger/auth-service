# Décorateurs custom

## @Public()

Marque un endpoint comme public (pas de JWT requis).

## @CurrentUser()

Injecte l'utilisateur courant dans le handler.

```typescript
@Get('me')
getProfile(@CurrentUser() user: User) {
  return user;
}
```
