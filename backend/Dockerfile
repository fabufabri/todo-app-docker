# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copiamos primero package.json para aprovechar la cache de Docker
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY server.js ./

# La imagen node:20-alpine ya trae un usuario sin privilegios llamado "node".
# Correr como root dentro del contenedor es innecesario y aumenta el
# impacto de una eventual vulnerabilidad en la app o sus dependencias.
USER node

EXPOSE 3000

CMD ["node", "server.js"]
