const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { graphqlUploadExpress } = require('graphql-upload-minimal');
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
const typeDefs = fs.readFileSync(
  path.join(__dirname, 'schema.graphql'),
  'utf-8'
);

const resolvers = {
  Query: {
    fileMetadata: async (_, { downloadId }) => {
      const file = await db.collection('files').findOne({ downloadId });
      if (!file) return null;
      
      // Check if file is expired
      const isExpired = new Date(file.expiresAt) < new Date();
      return { ...file, isExpired };
    },
    files: async () => {
      const files = await db.collection('files').find().toArray();
      return files.map(file => ({
        ...file,
        isExpired: new Date(file.expiresAt) < new Date()
      }));
    }
  },
  Mutation: {
    uploadFile: async (_, { file, originalFilename, mimeType, size, iv, salt, maxDownloads, expiresIn }) => {
      try {
        const { createReadStream, filename } = await file;
        const downloadId = crypto.randomBytes(16).toString('hex');
        const filePath = path.join(UPLOAD_DIR, downloadId);
        
        // Save the file
        const stream = createReadStream();
        const writeStream = fs.createWriteStream(filePath);
        await new Promise((resolve, reject) => {
          stream.pipe(writeStream)
            .on('finish', resolve)
            .on('error', reject);
        });

        // Get the encrypted file size
        const encryptedSize = fs.statSync(filePath).size;

        // Calculate expiry date
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

        // Save file metadata to database
        const fileDoc = {
          downloadId,
          filename,
          originalFilename,
          mimeType,
          size,
          encryptedSize,
          iv,
          salt,
          createdAt: new Date(),
          expiresAt,
          downloadCount: 0,
          maxDownloads: maxDownloads || null
        };

        await db.collection('files').insertOne(fileDoc);

        return {
          success: true,
          message: 'File uploaded successfully',
          file: { ...fileDoc, isExpired: false },
          downloadUrl: `/api/download/${downloadId}`
        };
      } catch (error) {
        console.error('Upload error:', error);
        return {
          success: false,
          message: 'Failed to upload file',
          file: null,
          downloadUrl: null
        };
      }
    },
    deleteFile: async (_, { downloadId }) => {
      try {
        const file = await db.collection('files').findOne({ downloadId });
        if (!file) return false;

        // Delete file from storage
        const filePath = path.join(UPLOAD_DIR, downloadId);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        // Delete from database
        await db.collection('files').deleteOne({ downloadId });
        return true;
      } catch (error) {
        console.error('Delete error:', error);
        return false;
      }
    },
    extendFileExpiry: async (_, { downloadId, duration }) => {
      try {
        const file = await db.collection('files').findOne({ downloadId });
        if (!file) return null;

        const newExpiry = new Date(file.expiresAt);
        newExpiry.setSeconds(newExpiry.getSeconds() + duration);

        await db.collection('files').updateOne(
          { downloadId },
          { $set: { expiresAt: newExpiry } }
        );

        return { ...file, expiresAt: newExpiry, isExpired: false };
      } catch (error) {
        console.error('Extend expiry error:', error);
        return null;
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
    },
  });

  // Start Apollo Server
  await server.start();

  // Middleware configuration
  app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
  }));

  app.use(express.json());
  
  // File upload middleware
  app.use(graphqlUploadExpress({
    maxFileSize: 100000000, // 100MB
    maxFiles: 1
  }));

  // GraphQL route
  app.use('/graphql', expressMiddleware(server));

  // Static file service (for file downloads)
  app.use('/uploads', express.static(UPLOAD_DIR));

  // File download route
  app.get('/api/download/:downloadId', async (req, res) => {
    try {
      const { downloadId } = req.params;
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