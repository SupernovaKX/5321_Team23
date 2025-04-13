const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { graphqlUploadExpress } = require('graphql-upload-minimal');
const { GraphQLUpload } = require('graphql-upload-minimal');
const { MongoClient } = require('mongodb');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Environment configuration
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'encrypted_file_storage';
const UPLOAD_DIR = path.join(__dirname, '../uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

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
    await db.collection('files').createIndex({ createdAt: 1 });
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Add GraphQL schema and resolvers
const typeDefs = `
  scalar Upload

  type File {
    downloadId: String!
    filename: String!
    expiresAt: String!
  }

  type UploadFileResponse {
    success: Boolean!
    message: String!
    downloadId: String
  }

  type Query {
    getFile(downloadId: String!): File
  }

  type Mutation {
    uploadFile(
      file: Upload!
      originalFilename: String!
      mimeType: String!
      size: Int!
      iv: String!
      salt: String!
      maxDownloads: Int
      expiresIn: Int
    ): UploadFileResponse!
  }
`;

const resolvers = {
  Upload: GraphQLUpload,
  Query: {
    getFile: async (_, { downloadId }) => {
      const file = await db.collection('files').findOne({ downloadId });
      if (!file) {
        throw new Error('File not found');
      }
      return file;
    }
  },
  Mutation: {
    uploadFile: async (_, { file, originalFilename, mimeType, size, iv, salt, maxDownloads = 1, expiresIn = 604800 }) => {
      try {
        const { createReadStream } = await file;
        
        // Generate a unique download ID
        const downloadId = crypto.randomBytes(16).toString('hex');
        
        // Create the file path
        const filePath = path.join(UPLOAD_DIR, downloadId);
        
        // Create a write stream
        const writeStream = fs.createWriteStream(filePath);
        
        // Pipe the file stream to the write stream
        await new Promise((resolve, reject) => {
          createReadStream()
            .pipe(writeStream)
            .on('finish', resolve)
            .on('error', reject);
        });
        
        // Calculate expiration date
        const expiresAt = new Date(Date.now() + expiresIn * 1000);
        
        // Save file metadata to database
        const newFile = {
          downloadId,
          filename: originalFilename,
          mimeType,
          size,
          iv,
          salt,
          maxDownloads,
          expiresAt,
          downloadCount: 0,
          createdAt: new Date()
        };
        
        await db.collection('files').insertOne(newFile);
        
        return {
          success: true,
          message: 'File uploaded successfully',
          downloadId
        };
      } catch (error) {
        console.error('Upload error:', error);
        return {
          success: false,
          message: error.message,
          downloadId: null
        };
      }
    }
  }
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
    }
  });

  // Start Apollo Server
  await server.start();

  // Middleware configuration
  app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Apollo-Require-Preflight'],
    exposedHeaders: ['Content-Disposition']
  }));

  // Add CSP headers
  app.use((req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' http://localhost:3000 http://localhost:4000; connect-src 'self' http://localhost:3000 http://localhost:4000;"
    );
    next();
  });

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));
  
  // File upload middleware
  app.use(graphqlUploadExpress({
    maxFileSize: 100000000, // 100MB
    maxFiles: 1,
    maxFieldSize: 100000000, // 100MB
    maxRequestSize: 100000000, // 100MB
    uploadDir: UPLOAD_DIR
  }));

  // GraphQL route
  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => {
      return {
        headers: req.headers,
        uploadDir: UPLOAD_DIR
      };
    }
  }));

  // Static file service (for file downloads)
  app.use('/uploads', express.static(UPLOAD_DIR));

  // File download route
  app.get('/api/download/:downloadId', async (req, res) => {
    try {
      const { downloadId } = req.params;
      
      // Handle error case
      if (downloadId === 'error') {
        return res.status(400).json({
          error: 'File upload failed',
          message: 'The file could not be uploaded. Please try again.'
        });
      }

      const file = await db.collection('files').findOne({ downloadId });
      
      if (!file) {
        return res.status(404).send('File not found');
      }

      // Check if file is expired
      if (new Date(file.expiresAt) < new Date()) {
        return res.status(410).send('File has expired');
      }

      // Check download limit
      if (file.maxDownloads && file.downloadCount >= file.maxDownloads) {
        return res.status(403).send('Maximum download limit reached');
      }

      const filePath = path.join(UPLOAD_DIR, file.downloadId);
      
      // Increment download count
      await db.collection('files').updateOne(
        { downloadId },
        { $inc: { downloadCount: 1 } }
      );

      // Set appropriate headers
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalFilename}"`);
      
      // Stream the file
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).send('Internal server error');
    }
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`
      🚀 Server ready at http://localhost:${PORT}/graphql
      📁 Encrypted file storage enabled
      🔒 End-to-end encryption ready
    `);
  });
}

connectToDatabase()
  .then(() => startServer())
  .catch(console.error);