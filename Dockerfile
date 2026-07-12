FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build && \
    npm prune --omit=dev && \
    npm cache clean --force && \
    find node_modules -type f \( -name '*.js.map' -o -name '*.md' \) -delete



FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "dist/main.js"]
