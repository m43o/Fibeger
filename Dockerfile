# ---------- Build stage (Bun) ----------
    FROM oven/bun:1 AS build
    WORKDIR /app
    
    # (Optional) native build deps for packages with native parts
    # RUN apt-get update && apt-get install -y --no-install-recommends \
    #     python3 build-essential \
    #  && rm -rf /var/lib/apt/lists/*
    
    # Copy lock/manifest first for better layer caching
    COPY package.json bun.lock* bun.lockb* ./
    RUN bun install --frozen-lockfile || bun install
    
    # Copy source
    COPY . .
    
    # If you rewrite schema during build as before:
    RUN cp prisma/schema.production.prisma prisma/schema.prisma || true
    
    # Generate Prisma client at build time with Bun
    RUN bunx --bun prisma generate
    
    # Build Next.js (standalone)
    ENV NODE_ENV=production
    RUN bun --bun next build
    
# ---------- Runtime stage (Bun) ----------
    FROM oven/bun:1 AS runner
    WORKDIR /app
    
    
    # Copy the standalone server + static assets + public files
    COPY --from=build /app/.next/standalone ./
    COPY --from=build /app/.next/static ./.next/static
    COPY --from=build /app/public ./public

    # Prisma schema & package.json for npx and node runtime
    COPY --from=build /app/prisma ./prisma
    COPY --from=build /app/package.json ./package.json

    
    # If you want `bunx prisma` available, keep prisma CLI in node_modules:
    # copy only @prisma/* and prisma binaries instead of full node_modules, OR
    # copy the full node_modules if simpler for now. The simplest is:
    COPY --from=build /app/node_modules ./node_modules
    
    USER bun
    ENV NODE_ENV=production
    ENV PORT=3000
    EXPOSE 3000
    
    # - run prisma db push if DATABASE_URL is set (don’t fail the container if it’s not ready)
    # - start Next's standalone server (server.js is emitted by standalone)
    CMD ["sh", "-lc", "echo 'Running prisma db push (if DATABASE_URL)'; \
      [ -n \"${DATABASE_URL:-}\" ] && bunx --bun prisma db push || true; \
      echo 'Starting app'; bun --bun server.js"]
    