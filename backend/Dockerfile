# Imagen del backend (API Express + TypeScript).
FROM node:22-alpine

WORKDIR /app

# Instalar dependencias (incluye devDeps: tsx y @faker-js/faker se usan para el seed).
COPY package*.json ./
RUN npm ci

# Copiar el código y compilar a dist/
COPY . .
RUN npm run build

EXPOSE 3000

# La config lee variables de entorno (inyectadas por docker-compose); el .env de
# la raíz no existe dentro del contenedor y se ignora silenciosamente.
CMD ["node", "dist/index.js"]
