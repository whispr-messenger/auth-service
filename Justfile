default:
    just --list

up:
    docker compose -f docker/dev/compose.yml up -d

down:
    docker compose -f docker/dev/compose.yml down --volumes

logs:
    docker compose -f docker/dev/compose.yml logs --follow

shell:
    docker compose -f docker/dev/compose.yml exec -it auth-service bash