# Build context is the repo root (see docker-compose.yml) — this stage runs
# the same `npm run build` a developer would run locally, then the runtime
# stage just serves the resulting dist/ as static files via nginx.
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY scripts/ scripts/
COPY src/ src/
COPY pages/ pages/
COPY uploads/ uploads/
COPY version.json ./
RUN npm run build

FROM nginx:alpine AS runtime
COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
