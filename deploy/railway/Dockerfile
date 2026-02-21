FROM node:22-alpine
WORKDIR /app
COPY deploy/railway/package.json ./
RUN npm install --omit=dev
COPY scripts/ais-relay.cjs ./
CMD ["node", "ais-relay.cjs"]
