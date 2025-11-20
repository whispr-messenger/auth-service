default:
    just --list

up:
    docker compose -f docker/dev/compose.yml up -d