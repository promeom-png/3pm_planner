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

# Copiamos el resto del código
COPY . .

# Construimos la parte visual (Vite)
# Esto genera la carpeta 'dist'
RUN npm run build

# El puerto 3000 es el que usa Cloud Run por defecto en nuestra configuración
EXPOSE 3000

# Iniciamos la aplicación
# Usamos el flag experimental para soporte nativo de TS en Node 22
CMD ["node", "--experimental-strip-types", "server.ts"]
