# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /workspace

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

COPY --from=builder /workspace/dist ./dist/
COPY --from=builder /workspace/package.json ./
RUN npm install --omit=dev

EXPOSE 3011

ENV PORT=3011
# RLN_NODE_URL must be set at runtime — e.g. http://host.docker.internal:3001
ENV RLN_NODE_URL=http://host.docker.internal:3001

CMD ["node", "dist/index.js"]
