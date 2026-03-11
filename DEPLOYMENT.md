# Deployment

## Server
- **Droplet IP:** 128.199.126.236
- **Port:** 3003
- **URLs:**
  - Campaign page: http://128.199.126.236:3003
  - Admin panel: http://128.199.126.236:3003/admin

## Prerequisites
- Docker and Docker Compose installed on the server

## Setup

### 1. Create `server/.env`
Copy `.env.example` and fill in real values:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<your-password>
SESSION_SECRET=<generate with: openssl rand -hex 32>
PORT=3003
ALLOWED_ORIGIN=http://128.199.126.236:3003
```

### 2. Start the container

```bash
docker compose up -d --build
```

## Managing the Container

```bash
# View logs
docker compose logs -f

# Stop
docker compose down

# Restart
docker compose restart

# Rebuild and restart after code changes
docker compose up -d --build
```

## Notes
- The app runs on **3003**.
- The SQLite database is persisted at `server/data/` via a Docker volume mount.
- The container restarts automatically unless manually stopped (`restart: unless-stopped`).
