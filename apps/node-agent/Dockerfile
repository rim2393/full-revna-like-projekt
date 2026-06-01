FROM node:24.13.0-alpine AS runtime

ARG XRAY_VERSION=v26.5.9

ENV NODE_ENV=production
ENV XRAY_LOCATION_ASSET=/usr/local/share/xray

WORKDIR /srv/lumen-node-agent

RUN apk add --no-cache ca-certificates curl unzip \
  && mkdir -p /usr/local/share/xray \
  && curl -fsSL -o /tmp/xray.zip "https://github.com/XTLS/Xray-core/releases/download/${XRAY_VERSION}/Xray-linux-64.zip" \
  && unzip -j /tmp/xray.zip xray geoip.dat geosite.dat -d /usr/local/share/xray \
  && install -m 0755 /usr/local/share/xray/xray /usr/local/bin/xray \
  && rm -f /tmp/xray.zip

COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

ENTRYPOINT ["node", "/srv/lumen-node-agent/src/cli.js"]
CMD ["--run"]
