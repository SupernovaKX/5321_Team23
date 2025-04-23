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

/**
 * 验证密码是否正确
 * @param {string} inputPassword - 用户输入的密码
 * @param {string} salt - 存储的盐值
 * @param {string} hashedPassword - 存储的哈希密码
 * @returns {boolean} - 验证结果
 */
function validatePassword(inputPassword, salt, hashedPassword) {
  const hash = crypto.createHash('sha256');
  hash.update(inputPassword + salt); // 使用输入的密码和盐生成哈希
  const inputHashedPassword = hash.digest('hex');
  return inputHashedPassword === hashedPassword;
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
    data: String
  }

  type UploadFileResponse {
    success: Boolean!
    message: String!
    downloadId: String
  }

  type DownloadFileResponse {
    success: Boolean!
    message: String!
    file: File
  }

  type Query {
    getFile(downloadId: String!): File
    getFileMetadata(downloadId: String!): File
    downloadFile(downloadId: String!): File!
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
    downloadFile(downloadId: String!, password: String!): DownloadFileResponse!
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
    downloadFile: async (_, { downloadId, password }) => {
      try {
        const file = await db.collection('files').findOne({ downloadId });
        if (!file) {
          throw new Error('文件不存在');
        }
    
        if (new Date() > new Date(file.expiresAt)) {
          throw new Error('文件已过期');
        }
    
        // 验证密码
        const isPasswordValid = validatePassword(password, file.salt, file.hashedPassword);
        if (!isPasswordValid) {
          throw new Error('密码错误');
        }
    
        const filePath = path.join(process.env.UPLOAD_DIR || 'uploads', downloadId);
        if (!fs.existsSync(filePath)) {
          throw new Error('文件在存储中不存在');
        }
    
        const fileData = fs.readFileSync(filePath, 'base64');
    
        return {
          success: true,
          message: '下载成功',
          file: {
            downloadId: file.downloadId,
            filename: file.filename,
            mimeType: file.mimeType,
            size: file.size,
            iv: file.iv,
            salt: file.salt,
            expiresAt: file.expiresAt,
            data: fileData
          }
        };
      } catch (error) {
        console.error('下载错误:', error);
        return {
          success: false,
          message: error.message,
          file: null
        };
      }
    }
  },
  Mutation: {
    uploadFile: async (_, { file, originalFilename, mimeType, size, iv, salt, maxDownloads = 1, expiresIn = 604800 }) => {
      try {
        const { createReadStream } = await file;

        const downloadId = crypto.randomBytes(16).toString('hex');
        const filePath = path.join(process.env.UPLOAD_DIR || 'uploads', downloadId);

        const writeStream = fs.createWriteStream(filePath);
        await new Promise((resolve, reject) => {
          createReadStream()
            .pipe(writeStream)
            .on('finish', resolve)
            .on('error', reject);
        });

        // 使用输入的盐生成哈希密码
        const hashedPassword = crypto.createHash('sha256').update(salt).digest('hex');

        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        const newFile = {
          downloadId,
          filename: originalFilename,
          mimeType,
          size,
          iv,
          salt,
          hashedPassword, // 存储哈希密码
          maxDownloads,
          expiresAt,
          downloadCount: 0,
          createdAt: new Date()
        };

        await db.collection('files').insertOne(newFile);

        return {
          success: true,
          message: '文件上传成功',
          downloadId
        };
      } catch (error) {
        console.error('上传错误:', error);
        return {
          success: false,
          message: error.message,
          downloadId: null
        };
      }
    },
    downloadFile: async (_, { downloadId, password }) => {
      try {
        const file = await db.collection('files').findOne({ downloadId });
        if (!file) {
          throw new Error('文件不存在');
        }

        if (new Date() > new Date(file.expiresAt)) {
          throw new Error('文件已过期');
        }

        // 验证密码
        const isPasswordValid = validatePassword(password, file.salt, file.hashedPassword);
        if (!isPasswordValid) {
          throw new Error('密码错误');
        }

        const filePath = path.join(process.env.UPLOAD_DIR || 'uploads', downloadId);
        if (!fs.existsSync(filePath)) {
          throw new Error('文件在存储中不存在');
        }

        const fileData = fs.readFileSync(filePath, 'base64');

        return {
          success: true,
          message: '下载成功',
          file: {
            downloadId: file.downloadId,
            filename: file.filename,
            mimeType: file.mimeType,
            size: file.size,
            iv: file.iv,
            salt: file.salt,
            expiresAt: file.expiresAt,
            data: fileData
          }
        };
      } catch (error) {
        console.error('下载错误:', error);
        return {
          success: false,
          message: error.message,
          file: null
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
  const server = new ApolloServer({
    schema: makeExecutableSchema({ typeDefs, resolvers }),
    csrfPrevention: true,
    cache: 'bounded',
    cors: false,
    formatError: (error) => {
      console.error('GraphQL Error:', error);
      return error;
    }
  });

  await server.start();

  app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:4000'],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Apollo-Require-Preflight'],
  }));

  app.use((req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' http://localhost:3000 http://localhost:4000; connect-src 'self' http://localhost:3000 http://localhost:4000;"
    );
    next();
  });

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));
  
  app.use(graphqlUploadExpress({
    maxFileSize: 100000000,
    maxFiles: 1,
    maxFieldSize: 100000000,
    maxRequestSize: 100000000,
    uploadDir: UPLOAD_DIR
  }));

  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => {
      return {
        headers: req.headers,
        uploadDir: UPLOAD_DIR
      };
    }
  }));

  app.use('/uploads', express.static(UPLOAD_DIR));

  async function exampleDownloadFile(downloadId) {
    const { data } = await downloadFile({
      variables: { downloadId }
    });

    const fileContent = atob(data.downloadFile.data);
    console.log('Decoded file content:', fileContent);
  }

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