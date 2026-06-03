FROM node:26-alpine AS builder

WORKDIR /app
COPY admin-web/package*.json ./
RUN npm ci
COPY admin-web/ ./
RUN npm run build

FROM nginx:1.27-alpine

COPY admin-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html/admin

EXPOSE 80
