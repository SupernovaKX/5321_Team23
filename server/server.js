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
const fetch = require('node-fetch');

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

        if (!file) {
          throw new Error('No file provided');
        }

        const { createReadStream } = await file;
        
        // Generate a unique download ID
        const downloadId = crypto.randomBytes(16).toString('hex');
        console.log('Generated downloadId:', downloadId);
        
        // Create the file path
        const filePath = path.join(UPLOAD_DIR, downloadId);
        console.log('Saving file to:', filePath);
        
        // Create a write stream
        const writeStream = fs.createWriteStream(filePath, { encoding: 'binary' });
        
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
          message: error.message || 'Failed to upload file',
          downloadId: null
        };
      }
    },
    downloadFile: async (_, { downloadId }) => {
      try {
        const response = await fetch(`http://localhost:${PORT}/api/download/${downloadId}`);
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to download file');
        }
        return await response.json();
      } catch (error) {
        console.error('Download error:', error);
        throw error;
      }
    }
  }
};

// Create Express application
const app = express();

// Configure CORS
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CLIENT_URL 
    : 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Apollo-Require-Preflight'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

// Add middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cors(corsOptions));

// Configure file upload middleware
app.use(graphqlUploadExpress({
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxFiles: 1
}));

// Add file download endpoint
app.get('/api/download/:downloadId', async (req, res) => {
  // Set CORS headers for this specific endpoint
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Apollo-Require-Preflight');

  try {
    const { downloadId } = req.params;
    
    // Get file metadata from database
    const file = await db.collection('files').findOne({ downloadId });
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check if file has expired
    if (new Date(file.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'File has expired' });
    }
    
    // Check download count
    if (file.downloadCount >= file.maxDownloads) {
      return res.status(403).json({ error: 'Maximum download limit reached' });
    }
    
    // Read the encrypted file
    const filePath = path.join(UPLOAD_DIR, downloadId);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    
    // Read file data and convert to base64
    const fileData = fs.readFileSync(filePath);
    const base64Data = fileData.toString('base64');
    
    // Increment download count
    await db.collection('files').updateOne(
      { downloadId },
      { $inc: { downloadCount: 1 } }
    );
    
    // Send response with file data
    res.json({
      filename: file.filename,
      mimeType: file.mimeType,
      data: base64Data,
      iv: file.iv,
      salt: file.salt
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message || 'Failed to download file' });
  }
});

// Add endpoint to reset download count
app.post('/api/reset-downloads/:downloadId', cors(corsOptions), async (req, res) => {
  try {
    const { downloadId } = req.params;
    console.log('Resetting download count for file:', downloadId);
    
    const result = await db.collection('files').updateOne(
      { downloadId },
      { $set: { downloadCount: 0 } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.json({ success: true, message: 'Download count reset successfully' });
  } catch (error) {
    console.error('Reset download count error:', error);
    res.status(500).json({ error: 'Failed to reset download count' });
  }
});

async function startServer() {
  // Create Apollo Server instance
  const server = new ApolloServer({
    schema: makeExecutableSchema({ typeDefs, resolvers }),
    formatError: (error) => {
      console.error('GraphQL Error:', error);
      return error;
    },
    csrfPrevention: true,
    cache: 'bounded',
    plugins: [
      {
        async requestDidStart() {
          return {
            async willSendResponse({ response }) {
              response.http.headers.set('Access-Control-Allow-Origin', corsOptions.origin);
              response.http.headers.set('Access-Control-Allow-Credentials', 'true');
            }
          };
        }
      }
    ]
  });

  // Start Apollo Server
  await server.start();

  // Apply middleware
  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => {
      return {
        headers: req.headers,
        uploadDir: UPLOAD_DIR
      };
    }
  }));

  // Start the server
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

// Start the server
connectToDatabase()
  .then(() => startServer())
  .catch(console.error);