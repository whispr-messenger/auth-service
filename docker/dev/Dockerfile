FROM node:22-bookworm-slim

COPY ./requirements.txt .

# Installer les dépendances système
RUN apt-get update && apt-get install -y $(cat requirements.txt) \
    && rm -rf /var/lib/apt/lists/*

# Installer des outils utiles
RUN npm install -g @nestjs/cli typescript ts-node nodemon

# Créer l'utilisateur node si pas déjà existant
RUN if ! id -u node > /dev/null 2>&1; then \
    useradd -m -s /bin/bash node; fi

# Définir le répertoire de travail
WORKDIR /workspace

# Changer vers l'utilisateur node
USER node

# Exposer les ports
EXPOSE 3000 9229

# Commande par défaut
CMD ["sleep", "infinity"]