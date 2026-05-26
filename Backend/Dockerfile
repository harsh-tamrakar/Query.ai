# Use official Bun image
FROM oven/bun:1

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN bunx prisma generate --schema ./prisma/schema.prisma

# Copy rest of source code
COPY . .

# Expose port
EXPOSE 3000

# Start the server
CMD ["bun", "index.ts"]
