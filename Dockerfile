FROM node:20-alpine AS base

# Dependencias para Prisma (alpine necesita compatibilidad)
RUN apk add --no-cache libc6-compat openssl

# Instala dependencias
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Construye el código
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Configura NEXT_TELEMETRY en falso para proteger privacidad y datos
ENV NEXT_TELEMETRY_DISABLED=1

# Si necesitas DATABASE_URL compílala en este punto
RUN npm run build

# Crea la imagen de producción
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Solo copia la carpeta pública si tienes assets estáticos
COPY --from=builder /app/public ./public

# Directorios de Next.js para caché
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Usa el "output_standalone" generado
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
# Importante para que Docker/Cloud Run exponga en 0.0.0.0 y no localhost
ENV HOSTNAME="0.0.0.0"

# Ejecuta el servidor Node generado
CMD ["node", "server.js"]
