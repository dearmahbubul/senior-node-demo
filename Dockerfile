# ---- Stage 1: Build ----
FROM node:22.16.0-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Placeholder only — prisma generate reads the schema, doesn't connect to a real DB
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

RUN npx prisma generate
RUN npm run build

# ---- Stage 2: Production ----
FROM node:22.16.0-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "dist/server.js"]





#FROM node:22
#
#WORKDIR /app
#
#COPY package*.json ./
#RUN npm install
#
#COPY . .
#
#RUN npm run build
#
#EXPOSE 3000
#
#CMD ["node", "dist/server.js"]
#
#This works, but the final image contains:
#
#TypeScript source files
#Development dependencies
#Build tools
#npm cache
#Everything from your project
#
#Your production container doesn't actually need most of these.

