# 1. Node.js 18 Alpine base image
FROM node:22-alpine

# 2. Install dependencies for Prisma and native modules like bcrypt
RUN apk add --no-cache \
    openssl \
    python3 \
    make \
    g++ \
    build-base

# 3. Set working directory
WORKDIR /app

# 4. Copy package files
COPY package*.json ./

# 5. Install all dependencies
RUN npm install

# 6. Copy Prisma directory first to generate client
COPY prisma ./prisma/

# 7. Generate Prisma Client
RUN npx prisma generate

# 8. Copy the rest of the application code
COPY . .

# 9. Create uploads folder and fix permissions for the 'node' user
RUN mkdir -p uploads && chown -R node:node /app

# 10. Switch to non-root user for better security
USER node

# 11. Expose port 5000
EXPOSE 5000

# 12. Run Prisma push then start the server directly with node
CMD ["sh", "-c", "npx prisma db push && node src/app.js"]
