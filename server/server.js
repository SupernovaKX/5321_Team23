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
    mimeType: String!
    size: Int!
    iv: String!
    salt: String!
    expiresAt: String!
    maxDownloads: Int
    downloadCount: Int
  }

  type UploadFileResponse {
    success: Boolean!
    message: String!
    downloadId: String
  }

  type Query {
    getFile(downloadId: String!): File
    getFileMetadata(downloadId: String!): File
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
    
    downloadFile(downloadId: String!): File!
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
    },
    getFileMetadata: async (_, { downloadId }) => {
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
        console.log('Starting file upload:', {
          originalFilename,
          mimeType,
          size,
          hasIv: !!iv,
          hasSalt: !!salt
        });

        const { createReadStream } = await file;
        
        // Generate a unique download ID
        const downloadId = crypto.randomBytes(16).toString('hex');
        console.log('Generated downloadId:', downloadId);
        
        // Create the file path
        const filePath = path.join(UPLOAD_DIR, downloadId);
        console.log('Saving file to:', filePath);
        
        // Create a write stream
        const writeStream = fs.createWriteStream(filePath);
        
        // Pipe the file stream to the write stream
        await new Promise((resolve, reject) => {
          createReadStream()
            .pipe(writeStream)
            .on('finish', () => {
              console.log('File written successfully');
              resolve();
            })
            .on('error', (error) => {
              console.error('Error writing file:', error);
              reject(error);
            });
        });
        
        // Verify file was written
        if (!fs.existsSync(filePath)) {
          throw new Error('File was not written to disk');
        }
        
        const stats = fs.statSync(filePath);
        console.log('File stats:', {
          size: stats.size,
          exists: true
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
        
        console.log('Saving file metadata to database:', {
          downloadId,
          filename: originalFilename,
          hasIv: !!iv,
          hasSalt: !!salt
        });
        
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
    },
    downloadFile: async (_, { downloadId }) => {
      try {
        console.log('Download request for file:', downloadId);
        const file = await db.collection('files').findOne({ downloadId });
        
        if (!file) {
          console.log('File not found in database');
          throw new Error('File not found');
        }

        console.log('Found file in database:', {
          filename: file.filename,
          mimeType: file.mimeType,
          size: file.size,
          hasIv: !!file.iv,
          hasSalt: !!file.salt,
          downloadCount: file.downloadCount,
          maxDownloads: file.maxDownloads
        });

        // Check if file is expired
        if (new Date(file.expiresAt) < new Date()) {
          console.log('File has expired:', file.expiresAt);
          throw new Error('File has expired');
        }

        // Check download limit
        if (file.maxDownloads && file.downloadCount >= file.maxDownloads) {
          console.log('Download limit reached:', file.downloadCount, '/', file.maxDownloads);
          throw new Error('Maximum download limit reached');
        }

        // Increment download count
        await db.collection('files').updateOne(
          { downloadId },
          { $inc: { downloadCount: 1 } }
        );

        // Read the file
        const filePath = path.join(UPLOAD_DIR, file.downloadId);
        console.log('Reading file from path:', filePath);
        
        if (!fs.existsSync(filePath)) {
          console.log('File not found on disk:', filePath);
          throw new Error('File not found on disk');
        }

        const fileData = fs.readFileSync(filePath);
        console.log('File read successfully, size:', fileData.length);

        if (fileData.length === 0) {
          console.log('File is empty');
          throw new Error('File is empty');
        }

        // Return file data and metadata
        const response = {
          filename: file.filename,
          mimeType: file.mimeType,
          data: fileData.toString('base64'),
          iv: file.iv,
          salt: file.salt
        };

        console.log('Returning response with data length:', response.data.length);
        return response;
      } catch (error) {
        console.error('Download error:', error);
        throw error;
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