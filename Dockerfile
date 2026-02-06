# ==========================================
# Stage 1: Builder
# Compiles the PiNet Web3Os Vite application
# ==========================================
FROM node:20-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy dependency definitions first to leverage Docker layer caching
COPY package.json ./

# Install dependencies (clean install for reliability)
RUN npm install

# Copy the rest of the PiNet Web3Os source code
COPY . .

# Build the application (Generates the /dist folder)
# This respects the vite.config.ts settings
RUN npm run build

# ==========================================
# Stage 2: Production Runner
# Serves the static PiNet Web3Os files
# ==========================================
FROM node:20-alpine AS runner

# Add metadata labels
LABEL app="PiNet Web3Os"
LABEL version="1.0"
LABEL maintainer="Minima Global"

WORKDIR /app

# Install a lightweight static file server
RUN npm install -g serve

# Copy only the built artifacts from the builder stage
# This discards the heavy node_modules used for building
COPY --from=builder /app/dist ./dist

# Expose port 3000 (standard for this OS dashboard)
EXPOSE 3000
