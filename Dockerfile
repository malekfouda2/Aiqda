FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS backend-builder

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./

FROM node:20-alpine AS runner

WORKDIR /app/backend
ENV NODE_ENV=production

COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend ./
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

EXPOSE 3001

CMD ["node", "src/server.js"]
