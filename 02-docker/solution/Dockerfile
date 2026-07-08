# ---- Solution Dockerfile for the DevOps Workshop sample app ----
# Multi-stage build: keeps the final image small by not shipping
# build-time tools inside the image that actually runs in production.

# ---- Stage 1: install dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Stage 2: final runtime image ----
FROM node:20-alpine
WORKDIR /app

# Run as a non-root user — a small but real security best practice
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY index.js ./

ENV PORT=3000
ENV APP_VERSION=1.0.0

USER appuser
EXPOSE 3000

# Docker's own health check — separate from, but complementary to,
# the Kubernetes probes you'll add in Module 04.
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "index.js"]
