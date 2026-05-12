# Build stage for development
FROM node:20-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/image-memory-be/package.json ./apps/image-memory-be/
COPY packages/ ./packages/

RUN npm install --legacy-peer-deps

COPY . .

# Generate Prisma client for the specific app
RUN cd apps/image-memory-be && npx prisma generate

EXPOSE 3001

CMD ["npm", "run", "start", "--workspace=image-memory-be"]

# Build stage for production
FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/image-memory-be/package.json ./apps/image-memory-be/
COPY packages/ ./packages/

RUN npm install --legacy-peer-deps

COPY . .

RUN cd apps/image-memory-be && npx prisma generate
RUN npm run build --workspace=image-memory-be

# Production stage
FROM node:20-alpine AS production

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/image-memory-be/package.json ./apps/image-memory-be/
COPY packages/ ./packages/

RUN npm install --omit=dev --legacy-peer-deps

COPY --from=build /usr/src/app/apps/image-memory-be/dist ./apps/image-memory-be/dist
COPY --from=build /usr/src/app/apps/image-memory-be/prisma ./apps/image-memory-be/prisma

RUN cd apps/image-memory-be && npx prisma generate

EXPOSE 3001

CMD ["npm", "run", "start:prod", "--workspace=image-memory-be"]
