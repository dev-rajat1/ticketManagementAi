# Frontend Dockerfile — Nginx Static Server
FROM nginx:alpine

# Static files copy karo
COPY . /usr/share/nginx/html

# Nginx config copy karo
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Nginx default behavior is fine now
EXPOSE 80
