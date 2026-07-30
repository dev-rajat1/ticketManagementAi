# Frontend Dockerfile — Nginx Static Server
FROM nginx:alpine

# Static files copy karo
COPY . /usr/share/nginx/html

# Nginx config copy karo
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Railway port
EXPOSE 80

# Nginx ko env variable substitution ke saath start karo
CMD ["/bin/sh", "-c", "nginx -g 'daemon off;'"]
