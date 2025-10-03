FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create uploads directory
RUN mkdir -p uploads/cleaning_photos logs

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "server.js"]
