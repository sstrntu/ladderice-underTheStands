# Deployment

## Server
- **Droplet IP:** 128.199.126.236
- **Port:** `3002`
- **URLs:**
  - Campaign page: http://128.199.126.236:3002
  - Admin panel: http://128.199.126.236:3002/admin

## Prerequisites
- Docker and Docker Compose installed on the server

## Checkout
- `/root/uts-main`

## Environment File

### `/root/uts-main/server/.env`

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<your-password>
SESSION_SECRET=<generate with: openssl rand -hex 32>
PORT=3001
ALLOWED_ORIGIN=https://ladderice.co
```

## Start / Rebuild

```bash
cd /root/uts-main && docker compose -p uts-main up -d --build
```

## Manage Container

```bash
# Logs
cd /root/uts-main && docker compose -p uts-main logs -f

# Stop
cd /root/uts-main && docker compose -p uts-main down

# Restart
cd /root/uts-main && docker compose -p uts-main restart
```

## Notes
- Container listens on port `3001`, published as host port `3002`.
- SQLite database persists in `server/data/`.
- The container restarts automatically unless manually stopped (`restart: unless-stopped`).
