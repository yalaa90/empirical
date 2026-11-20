FROM node:22-alpine AS build

WORKDIR /app

ARG VITE_EMPIRICAL_WEB_URL=http://localhost:5175
ARG VITE_EMPIRICAL_WEB_ORIGIN=
ARG VITE_STOREFRONT_ORIGIN=http://localhost:5176
ENV VITE_EMPIRICAL_WEB_URL=$VITE_EMPIRICAL_WEB_URL \
    VITE_EMPIRICAL_WEB_ORIGIN=$VITE_EMPIRICAL_WEB_ORIGIN \
    VITE_STOREFRONT_ORIGIN=$VITE_STOREFRONT_ORIGIN

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/vite.config.ts ./vite.config.ts
COPY --from=build --chown=node:node /app/index.html ./index.html

USER node

EXPOSE 5176

CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "5176"]
