# Getting Started

Welcome to the **Authentication Service**! This tutorial will guide you through setting up your local development environment and running the service for the first time.

## Prerequisites

Before you begin, ensure you have the following installed:
- **Docker** and **Docker Compose**
- **Just** (a command runner: `brew install just` or `cargo install just`)
- **Node.js 18+** (optional, as the service runs in Docker)

## 1. Clone and Prepare

1. Clone the repository and navigate to the project root:
   ```bash
   git clone <repository-url>
   cd auth-service
   ```

2. Create your local environment file:
   ```bash
   cp docker/prod/.env.example docker/dev/.env
   ```
   *Note: For development, the default credentials in `.env.example` are usually sufficient, but ensure they don't conflict with other services.*

## 2. Start the Service

The project uses `Just` to simplify Docker commands. To start the development environment (including PostgreSQL and Redis):

```bash
just up dev
```

This command will:
- Build the Docker image.
- Start **PostgreSQL** and **Redis** containers.
- Run `npm install` inside the application container.
- Start the application with **SWC** (hot-reload enabled).

## 3. Verify the Installation

Once the containers are healthy, you can verify the service is running:

### API Documentation (Swagger)
Open your browser at: [http://localhost:3001/auth/swagger](http://localhost:3001/auth/swagger)

### Health Check
You can check the health status of the service and its dependencies:
```bash
curl http://localhost:3001/auth/v1/health/ready
```

## 4. Useful Commands

Here are the most common commands you'll use during development:

- **View Logs**: `just logs dev`
- **Stop Service**: `just down dev`
- **Run Tests**: `just test`
- **Container Shell**: `just shell`

---

**Next Step:** Check out the [Development Guide](../how-to/development.md) for more details on daily tasks.
