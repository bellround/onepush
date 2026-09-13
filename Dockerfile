FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine

WORKDIR /app

# 서버는 node 내장 모듈(node:sqlite, node:http)만 쓴다 — 런타임 의존성 없음.
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY server ./server

ENV PORT=80
ENV DB_PATH=/data/rounds.db
VOLUME /data

EXPOSE 80
CMD ["node", "server/index.ts"]
