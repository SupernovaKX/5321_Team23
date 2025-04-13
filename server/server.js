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
const { gql } = require('apollo-server');

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
    data: String  # 添加用于传输文件数据的字段
  }

  type UploadFileResponse {
    success: Boolean!
    message: String!
    downloadId: String
  }

  type Query {
    getFile(downloadId: String!): File
    getFileMetadata(downloadId: String!): File
    downloadFile(downloadId: String!): File!  # 添加下载查询
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
    },
    getFileMetadata: async (_, { downloadId }) => {
      const file = await db.collection('files').findOne({ downloadId });
      if (!file) {
        throw new Error('File not found');
      }
      return file;
    },
    downloadFile: async (_, { downloadId }) => {
      try {
        console.log('开始处理文件下载请求:', downloadId);
        
        // 从数据库获取文件信息
        const file = await db.collection('files').findOne({ downloadId });
        if (!file) {
          throw new Error('文件不存在');
        }

        // 检查文件是否过期
        if (new Date(file.expiresAt) < new Date()) {
          throw new Error('文件已过期');
        }

        // 检查下载次数限制
        if (file.maxDownloads && file.downloadCount >= file.maxDownloads) {
          throw new Error('已达到最大下载次数限制');
        }

        // 读取文件内容
        const filePath = path.join(UPLOAD_DIR, downloadId);
        if (!fs.existsSync(filePath)) {
          throw new Error('文件不存在于存储系统中');
        }

        // 以 base64 格式读取文件
        const fileData = fs.readFileSync(filePath);
        const base64Data = fileData.toString('base64');

        // 更新下载计数
        await db.collection('files').updateOne(
          { downloadId },
          { $inc: { downloadCount: 1 } }
        );

        console.log('文件下载成功:', {
          filename: file.filename,
          size: fileData.length,
          downloadCount: file.downloadCount + 1
        });

        // 返回文件信息和内容
        return {
          ...file,
          data: base64Data
        };

      } catch (error) {
        console.error('文件下载错误:', error);
        throw new Error(`文件下载失败: ${error.message}`);
      }
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
    }
  }
};

// GraphQL query for downloading a file
const DOWNLOAD_FILE = gql`
  query DownloadFile($downloadId: String!) {
    downloadFile(downloadId: $downloadId) {
      filename
      mimeType
      size
      data
      iv
      salt
    }
  }
`;

// Create Express application
const app = express();

async function startServer() {
  // Create Apollo Server instance
  const server = new ApolloServer({
    schema: makeExecutableSchema({ typeDefs, resolvers }),
    csrfPrevention: true,
    cache: 'bounded',
    cors: false, // 让 express 处理 CORS
    formatError: (error) => {
      console.error('GraphQL Error:', error);
      return error;
    }
  });

  // Start Apollo Server
  await server.start();

  // Middleware configuration
  app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:4000'],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Apollo-Require-Preflight'],
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

  // Example usage of the downloadFile query
  async function exampleDownloadFile(downloadId) {
    const { data } = await downloadFile({
      variables: { downloadId }
    });

    // 解码文件数据
    const fileContent = atob(data.downloadFile.data);
    console.log('Decoded file content:', fileContent);
  }

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