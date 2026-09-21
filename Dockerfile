# --- Stage 1: build ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Stage 2: serve (nginx) ---
FROM nginx:1.27-alpine
# Собираем в подпапку так, чтобы base '/family-stock-tracker/' приложения совпал с URL.
COPY --from=build /app/dist /usr/share/nginx/html/family-stock-tracker
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]