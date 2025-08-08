# Use official Node.js LTS Alpine image
FROM node:lts-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy app source
COPY . .

# Expose the app port
EXPOSE 3000

# Set environment variables (optional, can be overridden)
ENV PORT=3000

# Start the app
CMD ["node", "app.js"]


