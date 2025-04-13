// src/services/api.js

import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

// Create Apollo Client instance
const client = new ApolloClient({
  uri: process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
  cache: new InMemoryCache()
});

// Queries and Mutations for file upload
export const UPLOAD_FILE_MUTATION = gql`
  mutation UploadFile(
    $file: Upload!
    $originalFilename: String!
    $mimeType: String!
    $size: Int!
    $iv: String!
    $salt: String!
    $maxDownloads: Int
    $expiresIn: Int
  ) {
    uploadFile(
      file: $file
      originalFilename: $originalFilename
      mimeType: $mimeType
      size: $size
      iv: $iv
      salt: $salt
      maxDownloads: $maxDownloads
      expiresIn: $expiresIn
    ) {
      success
      message
      downloadId
    }
  }
`;

// Get file metadata
export const GET_FILE_METADATA = gql`
  query GetFileMetadata($downloadId: String!) {
    getFileMetadata(downloadId: $downloadId) {
      downloadId
      filename
      mimeType
      size
      iv
      salt
      expiresAt
      maxDownloads
      downloadCount
    }
  }
`;

// Upload encrypted file
export const uploadEncryptedFile = async (encryptedFile, metadata) => {
  try {
    const { data } = await client.mutate({
      mutation: UPLOAD_FILE_MUTATION,
      variables: {
        file: encryptedFile,
        originalFilename: metadata.filename,
        mimeType: metadata.mimeType,
        size: metadata.size,
        iv: metadata.iv,
        salt: metadata.salt,
        maxDownloads: metadata.maxDownloads,
        expiresIn: metadata.expiresIn
      },
      context: {
        headers: {
          'Apollo-Require-Preflight': 'true'
        }
      }
    });
    
    return data.uploadFile;
  } catch (error) {
    console.error('File upload failed:', error);
    throw new Error('File upload failed, please try again');
  }
};

// Get file metadata before download
export const getFileMetadata = async (downloadId) => {
  try {
    const { data } = await client.query({
      query: GET_FILE_METADATA,
      variables: { downloadId }
    });
    
    return data.getFileMetadata;
  } catch (error) {
    console.error('Failed to get file metadata:', error);
    throw new Error('File not found or link has expired');
  }
};

// Download encrypted file
export const downloadEncryptedFile = async (downloadId) => {
  try {
    // Get file metadata
    const metadata = await getFileMetadata(downloadId);
    
    // Use standard fetch API to download file
    const response = await fetch(`/api/download/${downloadId}`);
    if (!response.ok) {
      throw new Error('File download failed');
    }
    
    const encryptedFile = await response.blob();
    return { encryptedFile, metadata };
  } catch (error) {
    console.error('Download failed:', error);
    throw new Error('Download failed, please check if the link is valid');
  }
};
