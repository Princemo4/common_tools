# ---- Build Phase ----
FROM node:lts-alpine as build

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

COPY . .

# ---- Production Phase ----
FROM node:lts-alpine

WORKDIR /usr/src/app

# Copy node_modules and built files from build image
COPY --from=build /usr/src/app ./

# Set default PORT if not provided
ENV PORT=4001

# Start the app
CMD ["node", "app.js"]


