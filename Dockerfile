FROM linuxserver/docker-compose:latest

LABEL maintainer="Brandon Flick - https://bflick.dev"

RUN apt-get update
RUN apt-get -y install curl
RUN curl -sL https://deb.nodesource.com/setup_16.x  | bash -
RUN apt-get -y install nodejs
RUN mkdir -p /app
RUN mkdir -p /token
RUN mkdir -p /compose
RUN mkdir -p /appdata

WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

ENV MONGO_URL_STRING=mongodb://sb-database/sb-backend

EXPOSE 5850

CMD ["node", "server.js"]