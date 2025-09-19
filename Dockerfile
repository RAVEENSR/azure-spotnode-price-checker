FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Create data directory and set proper permissions
RUN mkdir -p /app/data && \
    chown -R 10014:10014 /app

EXPOSE 8080

USER 10014

CMD ["npm", "start"]
