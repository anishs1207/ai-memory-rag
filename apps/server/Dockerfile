# Build stage
FROM node:20-bullseye AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/ ./packages/

RUN npm install

COPY . .
RUN npm run build --workspace=server

# Production stage
FROM node:20-bullseye-slim AS production

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/ ./packages/

RUN npm ci --only=production

COPY --from=builder /usr/src/app/apps/server/dist ./apps/server/dist

ENV NODE_ENV=production \
    PORT=3001

EXPOSE 3001

CMD ["node", "apps/server/dist/index.js"]
