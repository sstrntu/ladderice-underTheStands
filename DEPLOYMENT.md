# Deployment

## Server
- **Droplet IP:** 128.199.126.236
- **Port:** 3002
- **URLs:**
  - Campaign page: http://128.199.126.236:3002
  - Admin panel: http://128.199.126.236:3002/admin

## Prerequisites
- Docker and Docker Compose installed on the server

## Setup

### 1. Create `server/.env`
Copy `.env.example` and fill in real values:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<your-password>
SESSION_SECRET=<generate with: openssl rand -hex 32>
PORT=3001
ALLOWED_ORIGIN=http://128.199.126.236:3002
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
- Port 3001 was already allocated by another service, so the app is exposed on **3002** externally (mapped to 3001 inside the container).
- The SQLite database is persisted at `server/data/` via a Docker volume mount.
- The container restarts automatically unless manually stopped (`restart: unless-stopped`).
