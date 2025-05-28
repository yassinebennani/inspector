FROM node:20-slim

WORKDIR /app

# Copy all files (including possible build scripts/folders)
COPY . .

# Install all dependencies (including dev)
RUN npm install

# Run build script (if any)
RUN npm run build

EXPOSE 6274 6277

ENV NODE_TLS_REJECT_UNAUTHORIZED=0

CMD ["npm", "start"]
