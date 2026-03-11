# Dockerfile for fullstack-playground (Next.js)

FROM node:18-alpine

WORKDIR /workspace

# Install common tools
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++

# Copy package files first (for better layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy ALL source code into the container
COPY . .

# Expose the port used by next dev
EXPOSE 5175

# Default command
CMD ["npm", "run", "dev"]




