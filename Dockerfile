FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=optional
COPY . .
# MCP stdio server. (agentscoin_mine additionally needs: npx playwright install chromium)
CMD ["node", "index.js"]
