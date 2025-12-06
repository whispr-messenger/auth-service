# Authentication Service
<!-- [![Quality Gate Status](https://sonarqube.whispr.epitech-msc2026.me/api/project_badges/measure?project=whispr-messenger_auth-service_11813afb-b949-4baf-aa3f-7d12c436cb56&metric=alert_status&token=sqb_447aebc169925a474766cc3247a75fd2b838eeb6)](https://sonarqube.whispr.epitech-msc2026.me/dashboard?id=whispr-messenger_auth-service_11813afb-b949-4baf-aa3f-7d12c436cb56) -->

[![App Status](https://argocd.whispr.epitech-msc2026.me/api/badge?name=auth-service&revision=true&showAppName=true)](https://argocd.whispr.epitech-msc2026.me/applications/auth-service)
---
- [Documentation](https://whispr-messenger.github.io/auth-service/)
- [Swagger UI](https://whispr.epitech-msc2026.me/auth/swagger)
- [ArgoCD UI](https://argocd.whispr.epitech-msc2026.me)
- [SonarQube](https://sonarqube.whispr.epitech-msc2026.me)

## Description

This Microservice is responsible of all authentication tasks in the Whispr Messenger system.

## Installation

The repository uses `just` a custom recipe runner (like `make` in C lang) to provide useful scripts.

Once you have `just` and `docker` installed in your computer you can start the development server with:

```sh
just up dev
```
