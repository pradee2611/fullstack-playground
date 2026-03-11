# Example Dockerfile for workspace containers
# This is a template - each workspace would have its own container

FROM node:18-alpine

WORKDIR /workspace

# Install common tools
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Expose port
EXPOSE 3000

# Default command
CMD ["npm", "run", "dev"]




