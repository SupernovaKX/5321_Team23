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
      file {
        downloadId
        filename
        expiresAt
      }
    }
  }
`;

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [uploadFile] = useMutation(UPLOAD_FILE);

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
  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError('');

    try {
      setProgress(20);
      const fileReader = new FileReader();
      
      fileReader.onload = async (e) => {
        try {
          setProgress(40);
          const { encryptedData, iv, salt } = await encryptFile(e.target.result);
          setProgress(60);
          
          // Create encrypted file object
          const encryptedFile = new Blob([encryptedData], { 
            type: 'application/octet-stream' 
          });

          // Upload to server
          const response = await uploadFile({
            variables: {
              file: encryptedFile,
              originalFilename: file.name,
              mimeType: file.type || 'application/octet-stream',
              size: file.size,
              iv: iv,
              salt: salt,
              maxDownloads: 1, // Default to allow only one download
              expiresIn: 604800 // Default 7 days expiration
            }
          });

          if (response.data.uploadFile.success) {
            setProgress(100);
            alert('File encrypted and uploaded successfully! Please save your encryption key, it will be needed to decrypt the file.');
          } else {
            throw new Error(response.data.uploadFile.message || 'Upload failed');
          }
          
        } catch (error) {
          setError(error.message);
        } finally {
          setUploading(false);
        }
      };

      fileReader.onerror = () => {
        setError('File reading failed');
        setUploading(false);
      };

      fileReader.readAsArrayBuffer(file);

    } catch (error) {
      setError('Upload process error: ' + error.message);
      setUploading(false);
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
          onClick={handleUpload} 
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