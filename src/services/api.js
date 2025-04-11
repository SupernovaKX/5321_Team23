// src/services/api.js

import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

// 创建Apollo Client实例
const client = new ApolloClient({
  uri: process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
  cache: new InMemoryCache()
});

// 上传文件的相关Query和Mutation
export const UPLOAD_FILE_MUTATION = gql`
  mutation UploadFile($file: Upload!, $metadata: String!) {
    uploadFile(file: $file, metadata: $metadata) {
      id
      downloadId
      createdAt
      expiresAt
    }
  }
`;

// 获取文件元数据
export const GET_FILE_METADATA = gql`
  query GetFileMetadata($downloadId: String!) {
    fileMetadata(downloadId: $downloadId) {
      id
      metadata
      filename
      expiresAt
    }
  }
`;

// 上传加密文件
export const uploadEncryptedFile = async (encryptedFile, metadata) => {
  // 创建FormData以传输文件
  const file = new File([encryptedFile], 'encrypted_file.bin', {
    type: 'application/octet-stream',
  });
  
  try {
    const { data } = await client.mutate({
      mutation: UPLOAD_FILE_MUTATION,
      variables: {
        file: file,
        metadata: JSON.stringify(metadata)
      },
      context: {
        useMultipart: true // 使用multipart/form-data格式发送文件
      }
    });
    
    return data.uploadFile;
  } catch (error) {
    console.error('上传文件失败:', error);
    throw new Error('上传文件失败，请重试');
  }
};

// 获取文件元数据以准备下载
export const getFileMetadata = async (downloadId) => {
  try {
    const { data } = await client.query({
      query: GET_FILE_METADATA,
      variables: { downloadId }
    });
    
    return data.fileMetadata;
  } catch (error) {
    console.error('获取文件元数据失败:', error);
    throw new Error('找不到文件或链接已过期');
  }
};

// 下载加密文件
export const downloadEncryptedFile = async (downloadId) => {
  try {
    // 获取文件元数据
    const metadata = await getFileMetadata(downloadId);
    
    // 使用普通的fetch API下载文件
    const response = await fetch(`/api/download/${downloadId}`);
    if (!response.ok) {
      throw new Error('文件下载失败');
    }
    
    const encryptedFile = await response.blob();
    return { encryptedFile, metadata: JSON.parse(metadata.metadata) };
  } catch (error) {
    console.error('下载文件失败:', error);
    throw new Error('下载文件失败，请检查链接是否有效');
  }
};
