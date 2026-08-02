#!/bin/sh
# env-config.js create karo BACKEND_URL ke saath
echo "window.ENV_BACKEND_URL = \"${BACKEND_URL:-http://localhost:5000}\";" > /usr/share/nginx/html/env-config.js
echo "✅ env-config.js created with BACKEND_URL: ${BACKEND_URL}"

# Nginx start karo
nginx -g 'daemon off;'
