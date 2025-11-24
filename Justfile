default:
    just --list

up ENV:
    #!/bin/bash
    if [ "{{ENV}}" = "dev" ]; then
        docker compose -f docker/dev/compose.yml up -d
    elif [ "{{ENV}}" = "prod" ]; then
        docker compose -f docker/prod/compose.yml up --detach --build
    else
        echo "{{ENV}}: Accepted values are 'dev' or 'prod'." >&2
    fi

down ENV:
    #!/bin/bash
    if [ "{{ENV}}" = "dev" ]; then
        docker compose -f docker/dev/compose.yml down --volumes
    elif [ "{{ENV}}" = "prod" ]; then
        docker compose -f docker/prod/compose.yml down --volumes
    else
        echo "{{ENV}}: Accepted values are 'dev' or 'prod'." >&2
    fi

logs:
    docker compose -f docker/dev/compose.yml logs --follow

shell:
    docker compose -f docker/dev/compose.yml exec -it auth-service bash

test:
    docker compose -f docker/dev/compose.yml exec -it auth-service npm run test
