# ==========================================
# Stage 1: Base Image
# ==========================================
FROM node:22.16.0-alpine AS base

# Set working directory inside the container
WORKDIR /app

# Add local node_modules/.bin to PATH for direct execution of CLI binaries
ENV PATH="/app/node_modules/.bin:$PATH"

# Install tini init process to properly manage PID 1, handle kernel signals (SIGTERM/SIGINT), and reap zombie processes
RUN apk add --no-cache tini


# ==========================================
# Stage 2: Development Runtime
# ==========================================
# Development stage with all dependencies (including devDependencies like tsx) for live code reloading
FROM base AS development

# Set Node environment to development
ENV NODE_ENV=development

# Copy dependency manifests
COPY package*.json ./
# Clean install all dependencies (including devDependencies)
RUN npm ci

# Copy source code into the container
COPY . .

# Dummy DATABASE_URL placeholder required by Prisma CLI during code generation
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

# Generate Prisma Client and TypeScript types from Prisma schema
RUN npx prisma generate

# Create dedicated non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create upload directory and grant ownership to non-root user for local file storage
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app/uploads

# Switch from root to non-root user
USER appuser

# Document that the application listens on port 3000 inside the container
EXPOSE 3000

# Use tini as the entrypoint init system
ENTRYPOINT ["/sbin/tini", "--"]

# Default command for development
CMD ["npm", "run", "dev"]


# ==========================================
# Stage 3: Build & Compilation
# ==========================================
# Uses lightweight Node.js Alpine base image to install dependencies and compile TypeScript
FROM base AS builder

# Copy dependency manifests first to leverage Docker layer caching
COPY package*.json ./
# Clean install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy the entire source code into the build container
COPY . .

# Dummy DATABASE_URL placeholder required by Prisma CLI during code generation (does not connect to a real DB)
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

# Generate Prisma Client and TypeScript types from Prisma schema
RUN npx prisma generate

# Compile TypeScript source code to JavaScript in dist/ directory
RUN npm run build


# ==========================================
# Stage 4: Production Runtime
# ==========================================
# Minimal production runtime image without devDependencies or compiler overhead
FROM base AS production

# Set Node environment to production
ENV NODE_ENV=production

# Copy package manifests and install only production runtime dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JavaScript output and generated artifacts from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Create a dedicated non-root user and group for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create upload directory and grant ownership to non-root user for local file storage
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app/uploads

# Switch from root to non-root user for principle of least privilege
USER appuser

# Document that the application listens on port 3000 inside the container
EXPOSE 3000

# Use tini as the entrypoint init system for graceful shutdown signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Default command to start the Express application server
CMD ["node", "dist/server.js"]

