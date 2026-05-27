# Use official Bun image
FROM oven/bun:1

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock* bunfig.toml ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy all source code
COPY . .

# Expose port
EXPOSE 3000

# Start the Bun server
CMD ["bun", "src/index.ts"]
