# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /workspace

COPY wdk-wallet-rln-mcp/package*.json ./wdk-wallet-rln-mcp/
RUN cd wdk-wallet-rln-mcp && npm install
COPY wdk-wallet-rln-mcp/ ./wdk-wallet-rln-mcp/
RUN cd wdk-wallet-rln-mcp && npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /workspace/wdk-wallet-rln-mcp/dist ./dist/
COPY --from=builder /workspace/wdk-wallet-rln-mcp/package.json ./
RUN npm install --omit=dev

EXPOSE 3011

ENV PORT=3011
# RLN_NODE_URL must be set at runtime — e.g. http://host.docker.internal:3001
ENV RLN_NODE_URL=http://host.docker.internal:3001

CMD ["node", "dist/index.js"]
