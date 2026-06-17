FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

# ── Development (dùng trong docker-compose dev) ──────────────────────────────
FROM base AS development
COPY . .
RUN npx prisma generate
CMD ["npm", "run", "start:dev"]

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS build
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Production ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main"]
