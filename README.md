# 5321_Team23

## Project Setup

### Prerequisites
- Node.js and npm installed
- Docker installed (for MongoDB)

### Installation Steps

1. Install Docker:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

2. Start MongoDB using Docker:
```bash
sudo docker run -d -p 27017:27017 --name mongodb mongo:5.0
```

3. Verify MongoDB is running:
```bash
sudo docker ps
```

4. Install project dependencies:
```bash
npm install
```

5. Create required directories:
```bash
mkdir -p uploads
```

6. Start the development servers:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend (GraphQL): http://localhost:4000/graphql