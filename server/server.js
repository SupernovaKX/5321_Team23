const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { graphqlUploadExpress } = require('graphql-upload-minimal');
const { MongoClient } = require('mongodb');
const { makeExecutableSchema } = require('@graphql-tools/schema');  // Add this line
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Environment configuration
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'file_encryption';

let db;

// Initialize MongoDB connection
async function connectToDatabase() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db(DB_NAME);
    // Create indexes
    await db.collection('files').createIndex({ downloadId: 1 }, { unique: true });
    await db.collection('files').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Add GraphQL schema and resolvers
const typeDefs = fs.readFileSync(
  path.join(__dirname, 'schema.graphql'),
  'utf-8'
);

const resolvers = {
  Query: {
    fileMetadata: async (_, { downloadId }) => {
      return await db.collection('files').findOne({ downloadId });
    },
    files: async () => {
      return await db.collection('files').find().toArray();
    }
  },
  // ...other resolvers
};

// Create Express application
const app = express();

async function startServer() {
  // Create Apollo Server instance
  const server = new ApolloServer({
    schema: makeExecutableSchema({ typeDefs, resolvers }),
    formatError: (error) => {
      console.error('GraphQL Error:', error);
      return error;
    },
  });

  // Start Apollo Server
  await server.start();

  // Middleware configuration
  app.use(cors({
    origin: 'http://localhost:3000',  // Frontend application address
    credentials: true
  }));

  // Add CSP headers
  app.use((req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; connect-src 'self' http://localhost:4000; script-src 'self' 'unsafe-inline' 'unsafe-eval';"
    );
    next();
  });

  app.use(express.json());
  
  // File upload middleware
  app.use(graphqlUploadExpress({
    maxFileSize: 100000000, // 100MB
    maxFiles: 1
  }));

  // GraphQL route
  app.use('/graphql', expressMiddleware(server));

  // Static file service (for file downloads)
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  // File download route
  app.get('/api/download/:downloadId', async (req, res) => {
    try {
      const { downloadId } = req.params;
      const file = await db.collection('files').findOne({ downloadId });
      
      if (!file) {
        return res.status(404).send('File not found');
      }

      const filePath = path.join(__dirname, '../uploads', file.downloadId);
      res.download(filePath, file.filename);
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).send('Internal server error');
    }
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`
      🚀 Server ready at http://localhost:${PORT}/graphql
      📁 File uploads enabled
      🔒 End-to-end encryption ready
    `);
  });
}

connectToDatabase()
  .then(() => startServer())
  .catch(console.error);