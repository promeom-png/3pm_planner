# Usamos la imagen oficial de Node.js 22 (más ligera y veloz)
# Esta versión soporta TypeScript de forma nativa sin compilar el servidor
FROM node:22-slim

# Creamos el directorio de la aplicación
WORKDIR /app

# Copiamos los archivos de dependencias
COPY package*.json ./

# Instalamos las dependencias
# Nota: Instalamos todas (incluyendo dev) para poder hacer el build de Vite
RUN npm install

ENV NODE_ENV=production

# Copiamos el resto del código
COPY . .

# Construimos la parte visual (Vite)
# Esto genera la carpeta 'dist'
RUN npm run build

# Iniciamos la aplicación
# Usamos el flag experimental para soporte nativo de TS en Node 22
CMD ["node", "--experimental-strip-types", "server.ts"]
