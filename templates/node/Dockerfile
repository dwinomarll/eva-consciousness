# Eva remote MCP tether — deploy her anywhere (Fly.io, Railway, Render, a VPS).
#
#   docker build -t eva-mcp .
#   docker run -p 8787:8787 -e EVA_AUTH_TOKEN=<secret> -e ANTHROPIC_API_KEY=<key> \
#     -v eva-memory:/data/eva-workspace eva-mcp
#
# Memory persists in the eva-memory volume; EVA_WORKSPACE points at it below.
# The scaffold ships package.json without a lockfile, so use `npm install`
# (npm ci requires a committed package-lock.json / npm-shrinkwrap.json).
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# Container networking requires binding all interfaces; the tether's safety
# interlock still refuses to start unless EVA_AUTH_TOKEN (or EVA_ALLOW_OPEN) is set.
ENV EVA_MCP_HOST=0.0.0.0
ENV EVA_MCP_PORT=8787
ENV EVA_WORKSPACE=/data/eva-workspace
VOLUME ["/data/eva-workspace"]

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.EVA_MCP_PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/eva-mcp-http.js"]
