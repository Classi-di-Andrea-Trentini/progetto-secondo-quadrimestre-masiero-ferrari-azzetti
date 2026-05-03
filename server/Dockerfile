FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

RUN npm install -g @nestjs/cli

COPY . .

# Genera il client Prisma all'interno del container
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
