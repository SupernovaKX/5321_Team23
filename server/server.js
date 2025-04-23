// Load environment variables
require('dotenv').config();

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
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'encrypted_file_storage';
const UPLOAD_DIR = path.join(__dirname, '../uploads');

// Log environment variables (for debugging)
console.log('Environment variables:');
console.log('REACT_APP_BASE_URL:', process.env.REACT_APP_BASE_URL);
console.log('REACT_APP_GRAPHQL_ENDPOINT:', process.env.REACT_APP_GRAPHQL_ENDPOINT);
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('DB_NAME:', process.env.DB_NAME);

if (!MONGODB_URI) {
  console.error('Missing required environment variable: MONGODB_URI');
  process.exit(1);
}

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [process.env.REACT_APP_BASE_URL];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-apollo-operation-name',
    'apollo-require-preflight',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Credentials'
  ],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400 // 24 hours
};

// Use CORS middleware
const app = express();
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Add CSP headers
app.use((req, res, next) => {
  const baseUrl = process.env.REACT_APP_BASE_URL;
  const apiUrl = process.env.REACT_APP_GRAPHQL_ENDPOINT;
  
  if (!baseUrl || !apiUrl) {
    console.error('Missing required environment variables: REACT_APP_BASE_URL and/or REACT_APP_GRAPHQL_ENDPOINT');
    return res.status(500).send('Server configuration error');
  }
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', baseUrl);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-apollo-operation-name, apollo-require-preflight');
  
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; ` +
    `connect-src 'self' ${baseUrl} ${apiUrl}; ` +
    `script-src 'self' 'unsafe-inline' 'unsafe-eval'; ` +
    `style-src 'self' 'unsafe-inline'; ` +
    `img-src 'self' data:; ` +
    `font-src 'self' data:; ` +
    `frame-ancestors 'none'; ` +
    `form-action 'self'; ` +
    `base-uri 'self'; ` +
    `object-src 'none'; ` +
    `media-src 'self'; ` +
    `worker-src 'self' blob:;`
  );
  next();
});

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
        
        // Create a write stream with proper binary handling
        const writeStream = fs.createWriteStream(filePath, { 
          encoding: 'binary',
          flags: 'w'
        });
        
        // Track the total bytes written
        let totalBytesWritten = 0;
        let writeError = null;
        
        // Pipe the file stream to the write stream with proper error handling
        await new Promise((resolve, reject) => {
          const readStream = createReadStream();
          
          readStream.on('data', (chunk) => {
            try {
              const writeSuccess = writeStream.write(chunk, 'binary');
              if (!writeSuccess) {
                readStream.pause();
                writeStream.once('drain', () => {
                  readStream.resume();
                });
              }
              totalBytesWritten += chunk.length;
              console.log('Chunk written:', {
                size: chunk.length,
                total: totalBytesWritten,
                expected: size
              });
            } catch (error) {
              writeError = error;
              readStream.destroy();
              writeStream.end();
              reject(error);
            }
          });
          
          readStream.on('end', () => {
            if (!writeError) {
              writeStream.end();
              resolve();
            }
          });
          
          readStream.on('error', (error) => {
            writeError = error;
            writeStream.end();
            reject(error);
          });
          
          writeStream.on('error', (error) => {
            writeError = error;
            readStream.destroy();
            reject(error);
          });
          
          writeStream.on('finish', () => {
            if (!writeError) {
              resolve();
            }
          });
        });
        
        // Verify file was written
        if (!fs.existsSync(filePath)) {
          throw new Error('File was not written to disk');
        }
        
        // Wait a moment to ensure the file system has completed writing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const stats = fs.statSync(filePath);
        console.log('File stats:', {
          size: stats.size,
          exists: true,
          originalSize: size,
          encryptedSize: stats.size,
          expectedSize: size,
          difference: Math.abs(stats.size - size),
          bytesWritten: totalBytesWritten,
          filePath: filePath,
          writeComplete: totalBytesWritten === stats.size
        });
        
        // Verify file size matches the encrypted size
        // AES-GCM overhead includes:
        // - 16 bytes for IV
        // - 16 bytes for salt
        // - 16 bytes for authentication tag
        // - Padding (up to 16 bytes)
        const expectedEncryptedSize = size + 64; // Original size + maximum overhead
        const sizeDifference = Math.abs(stats.size - expectedEncryptedSize);
        const allowedDifference = Math.ceil(size * 0.1); // 10% tolerance for padding variations
        
        if (sizeDifference > allowedDifference) {
          console.error('Size validation failed:', {
            actualSize: stats.size,
            expectedSize: expectedEncryptedSize,
            difference: sizeDifference,
            allowedDifference: allowedDifference,
            originalSize: size,
            percentageDifference: (sizeDifference / size * 100).toFixed(2) + '%',
            padding: stats.size - size - 48 // Calculate actual padding used
          });
          throw new Error(`File size validation failed: expected ${expectedEncryptedSize} bytes, got ${stats.size} bytes (difference: ${sizeDifference}, ${(sizeDifference / size * 100).toFixed(2)}%)`);
        }
        
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
        const apiUrl = process.env.REACT_APP_GRAPHQL_ENDPOINT.replace('/graphql', '');
        const response = await fetch(`${apiUrl}/api/download/${downloadId}`);
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

// Add middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Configure file upload middleware
app.use(graphqlUploadExpress({
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxFiles: 1
}));

// Add file download endpoint
app.get('/api/download/:downloadId', async (req, res) => {
  let fileStream;
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
      return res.status(403).json({ error: 'Maximum downloads reached' });
    }
    
    // Get file path
    const filePath = path.join(UPLOAD_DIR, downloadId);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Content-Length', stats.size);
    
    // Create read stream
    fileStream = fs.createReadStream(filePath);
    
    // Handle stream errors
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file' });
      }
    });
    
    // Handle stream completion
    fileStream.on('end', async () => {
      try {
        // Only increment download count if the stream completed successfully
        await db.collection('files').updateOne(
          { downloadId },
          { $inc: { downloadCount: 1 } }
        );
      } catch (error) {
        console.error('Failed to update download count:', error);
      }
    });
    
    // Pipe the encrypted file to the response
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to download file' });
    }
    // Clean up the stream if it was created
    if (fileStream) {
      fileStream.destroy();
    }
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

// Add file metadata endpoint
app.get('/api/metadata/:downloadId', async (req, res) => {
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
      return res.status(403).json({ error: 'Maximum downloads reached' });
    }
    
    // Return file metadata
    res.json({
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
      expiresAt: file.expiresAt,
      maxDownloads: file.maxDownloads,
      downloadCount: file.downloadCount,
      iv: file.iv,
      salt: file.salt
    });
    
  } catch (error) {
    console.error('Metadata error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch file metadata' });
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
    csrfPrevention: {
      requestHeaders: ['x-apollo-operation-name', 'apollo-require-preflight']
    },
    cache: 'bounded',
    plugins: [
      {
        async requestDidStart() {
          return {
            async willSendResponse({ response }) {
              // Set CORS headers for GraphQL responses
              response.http.headers.set('Access-Control-Allow-Origin', process.env.REACT_APP_BASE_URL);
              response.http.headers.set('Access-Control-Allow-Credentials', 'true');
              response.http.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
              response.http.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-apollo-operation-name, apollo-require-preflight');
            }
          };
        }
      }
    ]
  });

  // Start Apollo Server
  await server.start();

  // Apply middleware with proper CORS handling
  app.use('/graphql', cors(corsOptions), expressMiddleware(server, {
    context: async ({ req }) => {
      return {
        headers: req.headers,
        uploadDir: UPLOAD_DIR
      };
    }
  }));

  // Start the server
  app.listen(PORT, () => {
    console.log(`Server running at ${process.env.REACT_APP_GRAPHQL_ENDPOINT.replace('/graphql', '')}`);
  });
}

// Start the server
connectToDatabase()
  .then(() => startServer())
  .catch(console.error);