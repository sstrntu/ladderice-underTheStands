FROM node:20-alpine

# Build tools required by better-sqlite3 native bindings
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies before copying source (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Ensure data directory exists for SQLite
RUN mkdir -p data

EXPOSE 3003

CMD ["node", "index.js"]
