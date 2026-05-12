FROM node:20-bullseye AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/grpc-test/package.json ./apps/grpc-test/
COPY packages/ ./packages/

RUN npm install

COPY . .
RUN npm run build --workspace=grpc-test

FROM node:20-bullseye-slim

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/grpc-test/package.json ./apps/grpc-test/
COPY packages/ ./packages/

RUN npm ci --only=production

COPY --from=builder /usr/src/app/apps/grpc-test/dist ./apps/grpc-test/dist
COPY --from=builder /usr/src/app/apps/grpc-test/*.proto ./apps/grpc-test/

CMD ["node", "apps/grpc-test/dist/index.js"]
