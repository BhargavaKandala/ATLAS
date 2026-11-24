FROM node:24-alpine AS build
WORKDIR /atlas
ENV NEXT_TELEMETRY_DISABLED=1
COPY . ./
RUN --mount=type=secret,id=registry_ca \
    if [ -f /run/secrets/registry_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/registry_ca; fi; \
    npm ci --cache /tmp/atlas-npm-cache \
    && npm run build \
    && rm -rf node_modules .next/cache /tmp/atlas-npm-cache

FROM node:24-alpine
WORKDIR /atlas
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /atlas/.next/standalone ./
COPY --from=build --chown=node:node /atlas/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
