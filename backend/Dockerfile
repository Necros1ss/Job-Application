FROM node:22-alpine AS builder

WORKDIR /app

# Chỉ copy mỗi package.json (không copy package-lock.json để tránh lỗi xung đột/lệch file lock)
COPY package.json ./

# Cài đặt trực tiếp từ package.json
RUN npm install --omit=dev

FROM node:22-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY sql ./sql

RUN mkdir -p uploads/cv uploads/profile && chown -R appuser:appgroup /app

USER appuser

EXPOSE 5000

CMD ["node", "src/server.js"]