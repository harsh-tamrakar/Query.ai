# Use official Bun image
FROM oven/bun:1

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install all dependencies (including devDependencies for prisma CLI)
RUN bun install --frozen-lockfile

# Copy all source code (including prisma schema)
COPY . .

# Generate Prisma client (after all files are copied)
RUN bunx prisma generate --schema ./prisma/schema.prisma

# Expose port
EXPOSE 3000

# Start the server
CMD ["bun", "index.ts"]
