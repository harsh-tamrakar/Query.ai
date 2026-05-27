# Use official Bun image
FROM oven/bun:1

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy all source code
COPY . .

# Build the static assets
RUN bun run build

# Expose port
EXPOSE 3000

# Start the Bun server in production mode
ENV NODE_ENV=production
CMD ["bun", "src/index.ts"]
