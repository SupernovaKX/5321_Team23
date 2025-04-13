import React, { useState } from 'react';
import './FileUpload.css';
import { useMutation } from '@apollo/client';
import { gql } from '@apollo/client';

const UPLOAD_FILE = gql`
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
      downloadUrl
    }
  }
`;

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [maxDownloads, setMaxDownloads] = useState(1);
  const [expiresIn, setExpiresIn] = useState(604800); // 7 days in seconds
  const [uploadFileMutation] = useMutation(UPLOAD_FILE, {
    onError: (error) => {
      console.error('GraphQL Error:', error);
      if (error.networkError) {
        console.error('Network Error:', error.networkError);
        if (error.networkError.message.includes('Content-Security-Policy')) {
          setError('Security policy error. Please check your browser settings or try a different browser.');
        } else {
          setError('Network error occurred. Please check your connection and try again.');
        }
      } else if (error.graphQLErrors) {
        console.error('GraphQL Errors:', error.graphQLErrors);
        setError('Server error occurred. Please try again later.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    }
  });

  // Generate random encryption key
  const generateKey = async () => {
    return await window.crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256
      },
      true,
      ["encrypt", "decrypt"]
    );
  };

  // Encrypt file
  const encryptFile = async (fileData) => {
    try {
      const key = await generateKey();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      
      const encryptedContent = await window.crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: iv
        },
        key,
        fileData
      );

      // Export key for future decryption
      const exportedKey = await window.crypto.subtle.exportKey("raw", key);
      const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
      setEncryptionKey(keyBase64);

      // Combine IV and encrypted data
      const encryptedArray = new Uint8Array(iv.length + encryptedContent.byteLength);
      encryptedArray.set(iv, 0);
      encryptedArray.set(new Uint8Array(encryptedContent), iv.length);
      
      return {
        encryptedData: encryptedArray,
        iv: btoa(String.fromCharCode(...iv)),
        salt: btoa(String.fromCharCode(...salt))
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('File encryption failed');
    }
  };

  // Handle file selection
  const handleFileChange = (e) => {
    if (e.target.files?.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 100 * 1024 * 1024) { // 100MB limit
        setError('File size cannot exceed 100MB');
        return;
      }
      setFile(selectedFile);
      setError('');
      setEncryptionKey(null);
    }
  };

  // Handle file upload
  const handleUpload = async (file) => {
    try {
      console.log('Starting upload...');
      console.log('File info:', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      // Read the file as ArrayBuffer
      const fileBuffer = await file.arrayBuffer();
      
      // Encrypt the file
      const { encryptedData, iv, salt } = await encryptFile(fileBuffer);
      
      // Create a Blob from the encrypted data
      const encryptedBlob = new Blob([encryptedData], { type: file.type });
      
      // Create a new File object from the Blob
      const encryptedFile = new File([encryptedBlob], file.name, { type: file.type });

      // Upload the file
      const { data } = await uploadFileMutation({
        variables: {
          file: encryptedFile,
          originalFilename: file.name,
          mimeType: file.type,
          size: file.size,
          iv,
          salt,
          maxDownloads,
          expiresIn
        },
        context: {
          headers: {
            'Apollo-Require-Preflight': 'true',
            'Content-Type': 'multipart/form-data'
          }
        }
      });

      if (data?.uploadFile?.success) {
        console.log('Upload successful:', data.uploadFile);
        setUploadStatus('success');
        setDownloadUrl(data.uploadFile.downloadUrl);
      } else {
        console.error('Upload failed:', data?.uploadFile?.message);
        setUploadStatus('error');
        setError(data?.uploadFile?.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setError(error.message);
    }
  };

  return (
    <div className="file-upload-container">
      <h2>Secure File Upload</h2>
      <p>Files will be encrypted in the browser, the server will never see the original file content.</p>
      
      <div className="upload-area">
        <input
          type="file"
          id="file-input"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <label htmlFor="file-input" className="file-input-label">
          {file ? file.name : 'Select File'}
        </label>
        
        {file && (
          <div className="file-info">
            <p>Filename: {file.name}</p>
            <p>Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <p>Type: {file.type || 'Unknown'}</p>
          </div>
        )}
        
        <button 
          onClick={() => handleUpload(file)} 
          disabled={!file || uploading} 
          className="upload-button"
        >
          {uploading ? 'Encrypting...' : 'Encrypt and Upload'}
        </button>
      </div>
      
      {uploading && (
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          <span>{progress}%</span>
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
      
      {encryptionKey && (
        <div className="encryption-key">
          <p>Encryption Key (Please save securely):</p>
          <code>{encryptionKey}</code>
        </div>
      )}
    </div>
  );
};

export default FileUpload;