FROM node:20-bullseye AS base

WORKDIR /usr/src/app

COPY package.*json ./

# development stage
FROM base AS development

RUN --mount=type=cache,target=/usr/src/app/.npm \
    npm set cache /usr/src/app/.npm && \
    npm install

COPY . .

CMD ["npm", "run", "dev"]

# production stage
FROM base AS production

ENV NODE_ENV=production

RUN --mount=type=cache,target=/usr/src/app/.npm \
    npm set cache /usr/src/app/.npm && \
    npm ci --only=production

USER node

COPY --chown=node:node ./healthcheck/ ./healthcheck/
COPY --chown=node:node ./src/ ./src/
COPY --chown=node:node index.js .

EXPOSE 3000

CMD ["npx tsc", "&&", "node", "dist/index.js"]