# Build stage for development
FROM node:20-alpine AS development

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy the rest of the application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose the port the app runs on
EXPOSE 3001

# Start the application in development mode
CMD ["npm", "run", "start"]

# Build stage for production
FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./

# Install all dependencies including dev for building
RUN npm install --legacy-peer-deps

COPY . .

# Generate Prisma client and build the app
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /usr/src/app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

# Copy only the necessary files from the build stage
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/prisma ./prisma

# Generate Prisma client in production stage
RUN npx prisma generate

# Expose the application port
EXPOSE 3001

# Start the application in production mode
CMD ["npm", "run", "start:prod"]
