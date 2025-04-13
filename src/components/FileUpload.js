// src/components/FileUpload.js

import React, { useState } from 'react';
import { encryptFile, generatePassword } from '../services/crypto';
import { uploadEncryptedFile } from '../services/api';

const FileUpload = ({ onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files?.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError(''); // Clear previous errors
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    try {
      setUploading(true);
      setProgress(10);

      // Generate random password
      const password = generatePassword(24);
      setProgress(20);

      // Encrypt file in browser
      const { encryptedFile, metadata } = await encryptFile(file, password);
      setProgress(60);

      // Upload encrypted file to server
      const result = await uploadEncryptedFile(encryptedFile, metadata);
      setProgress(100);

      // Generate download URL
      const downloadUrl = `${window.location.origin}/download/${result.downloadId}`;

      // Notify parent component of completion
      onUploadComplete({
        downloadUrl,
        password,
        expiresAt: result.expiresAt,
        originalFileName: file.name
      });

      // Reset state
      setFile(null);
      
    } catch (err) {
      console.error('Upload failed:', err);
      setError('File upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="file-upload-container">
      <h2>Secure File Sharing</h2>
      <p>All files are encrypted in your browser before upload. The server never sees the file content or encryption keys.</p>
      
      <div className="upload-area">
        <input
          type="file"
          id="file-input"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <label htmlFor="file-input" className="file-input-label">
          {file ? file.name : 'Choose File'}
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
          {uploading ? 'Uploading...' : 'Encrypt & Upload'}
        </button>
      </div>
      
      {uploading && (
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          <span>{progress}%</span>
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default FileUpload;
