default:
    just --list

up:
    docker compose -f docker/docker-compose.yml up -d