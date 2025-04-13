// src/components/FileDownload.js

import React, { useState, useEffect } from 'react';
import '../styles/theme.css';
import './FileDownload.css';
import { decryptFile } from '../services/crypto';

const FileDownload = ({ fileId, onDownloadComplete }) => {
  const [fileMetadata, setFileMetadata] = useState(null);
  const [password, setPassword] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchFileMetadata = async () => {
      try {
        console.log('Fetching metadata for fileId:', fileId);
        if (!fileId) {
          throw new Error('No file ID provided');
        }
        const response = await fetch(`http://localhost:4000/api/metadata/${fileId}`);
        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 404) {
            throw new Error('File not found');
          } else if (response.status === 410) {
            throw new Error('File has expired');
          } else if (response.status === 403) {
            throw new Error('Maximum downloads reached');
          } else {
            throw new Error('Failed to fetch file metadata');
          }
        }
        const data = await response.json();
        setFileMetadata(data);
      } catch (error) {
        console.error('Error fetching metadata:', error);
        setError(error.message);
        onDownloadComplete({
          type: 'error',
          title: 'Error',
          message: error.message
        });
      } finally {
        setLoading(false);
      }
    };

    fetchFileMetadata();
  }, [fileId, onDownloadComplete]);

  const handleDownload = async () => {
    try {
      if (!password) {
        setError('Please enter the decryption password');
        return;
      }

      if (!fileMetadata.iv || !fileMetadata.salt) {
        throw new Error('Missing encryption parameters. The file may be corrupted.');
      }

      setIsDownloading(true);
      setError('');

      const response = await fetch(`http://localhost:4000/api/download/${fileId}`, {
        method: 'GET',
        credentials: 'include',
        mode: 'cors'
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || 'Failed to download file';
        } catch (e) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const encryptedData = await response.arrayBuffer();
      const decryptedData = await decryptFile(
        encryptedData,
        password,
        fileMetadata.iv,
        fileMetadata.salt
      );

      const blob = new Blob([decryptedData], { type: fileMetadata.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileMetadata.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onDownloadComplete({
        type: 'success',
        title: 'File Downloaded Successfully',
        message: 'Your file has been decrypted and downloaded securely.'
      });

      setPassword('');
    } catch (error) {
      setError(error.message || 'Failed to download file');
      onDownloadComplete({
        type: 'error',
        title: 'Download Failed',
        message: error.message || 'There was an error downloading your file. Please try again.'
      });
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading file information...</p>
      </div>
    );
  }

  if (error && !fileMetadata) {
    return (
      <div className="error-container">
        <div className="error-icon">❌</div>
        <h3>Error</h3>
        <p>{error}</p>
        <p>Please check your link or contact the file sender for a new link.</p>
      </div>
    );
  }

  return (
    <div className="file-download">
      <div className="download-info">
        <h3>File Information</h3>
        <p>File Name: {fileMetadata.filename}</p>
        <p>File Size: {(fileMetadata.size / 1024 / 1024).toFixed(2)} MB</p>
        <p>Expires: {new Date(fileMetadata.expiresAt).toLocaleString()}</p>
      </div>
      
      <div className="password-input-container">
        <h3>Decryption Password</h3>
        <p>Enter the password provided by the file sender:</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter decryption password"
          className="password-input"
        />
        {error && <p className="error-message">{error}</p>}
        <button
          onClick={handleDownload}
          disabled={isDownloading || !password}
          className="btn btn-primary"
        >
          {isDownloading ? 'Downloading...' : 'Download File'}
        </button>
      </div>
    </div>
  );
};

export default FileDownload;
