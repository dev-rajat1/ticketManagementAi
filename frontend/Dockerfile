# Frontend Dockerfile — Nginx Static Server
FROM nginx:alpine

# Static files copy karo
COPY . /usr/share/nginx/html

# Nginx config copy karo
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Entrypoint script copy karo
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

# Railway port
EXPOSE 80

# Script ke through start karo
CMD ["/docker-entrypoint.sh"]
