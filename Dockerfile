FROM node:18-slim

# Install dependencies for canvas
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libfontconfig1 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Remove build dependencies to reduce image size
RUN apt-get update && apt-get remove -y \
    build-essential \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Copy app source
COPY . .

# Create a non-root user for security
RUN groupadd -r chartuser && useradd -r -g chartuser chartuser \
    && chown -R chartuser:chartuser /app

# Switch to non-root user
USER chartuser

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "src/index.js"]