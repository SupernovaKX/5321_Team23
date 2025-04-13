// src/pages/DownloadPage.js
import '../style.css';

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, gql } from '@apollo/client';
import { decryptFile } from '../services/crypto';
import './DownloadPage.css';

const GET_FILE_METADATA = gql`
  query GetFileMetadata($downloadId: String!) {
    getFileMetadata(downloadId: $downloadId) {
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

const DownloadPage = () => {
  const { downloadId } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [fileMetadata, setFileMetadata] = useState(null);

  const { loading, error: queryError } = useQuery(GET_FILE_METADATA, {
    variables: { downloadId },
    onCompleted: (data) => {
      if (data?.getFileMetadata) {
        setFileMetadata(data.getFileMetadata);
      }
    },
    onError: (error) => {
      setError('Failed to fetch file information. The file may not exist or may have expired.');
    }
  });

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      setError('');

      // Fetch the encrypted file
      const response = await fetch(`/api/download/${downloadId}`);
      
      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const encryptedData = await response.arrayBuffer();
      
      // Decrypt the file
      const decryptedData = await decryptFile(encryptedData, password, fileMetadata.iv, fileMetadata.salt);
      
      // Create a blob from the decrypted data
      const blob = new Blob([decryptedData], { type: fileMetadata.mimeType });
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileMetadata.filename;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Navigate to success page or show success message
      navigate('/download/success');
    } catch (error) {
      console.error('Download error:', error);
      setError('Failed to download or decrypt the file. Please check your password and try again.');
    } finally {
      setIsDownloading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="download-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading file information...</p>
        </div>
      </div>
    );
  }
  
  if (queryError || !fileMetadata) {
    return (
      <div className="download-page">
        <div className="error-container">
          <h2>File Not Found</h2>
          <p>{error || 'The file you are looking for does not exist or may have expired.'}</p>
          <button className="primary-button" onClick={() => navigate('/')}>
            Return to Home
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="download-page">
      <div className="download-container">
        <h2>Download File</h2>
        
        <div className="file-info">
          <p><strong>Filename:</strong> {fileMetadata.filename}</p>
          <p><strong>Size:</strong> {(fileMetadata.size / 1024 / 1024).toFixed(2)} MB</p>
          <p><strong>Expires:</strong> {new Date(fileMetadata.expiresAt).toLocaleString()}</p>
        </div>
        
        <div className="password-input">
          <label htmlFor="password">Enter Decryption Password:</label>
              <input
            type="password"
            id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter the password provided by the sender"
          />
            </div>

        {error && <div className="error-message">{error}</div>}

            <button 
          className="download-button"
          onClick={handleDownload}
          disabled={!password || isDownloading}
        >
          {isDownloading ? 'Downloading...' : 'Download & Decrypt'}
            </button>
        
        <div className="security-note">
          <p>This file is protected by end-to-end encryption. The server never sees your password or the file contents.</p>
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;
