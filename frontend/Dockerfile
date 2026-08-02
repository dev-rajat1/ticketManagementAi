# Frontend Dockerfile — Nginx Static Server
FROM nginx:alpine

# Static files copy karo
COPY . /usr/share/nginx/html

# Nginx config copy karo
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Script inline taaki Windows line-ending (CRLF) ka koi issue na ho
CMD /bin/sh -c "echo \"window.ENV_BACKEND_URL = '${BACKEND_URL:-http://localhost:5000}';\" > /usr/share/nginx/html/env-config.js && nginx -g 'daemon off;'"
