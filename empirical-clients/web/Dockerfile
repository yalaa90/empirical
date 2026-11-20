FROM node:22-alpine AS build

WORKDIR /app

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5175

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server.mjs ./server.mjs

USER node

EXPOSE 5175

CMD ["node", "server.mjs"]
