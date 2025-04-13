// src/pages/DownloadPage.js
import '../style.css';

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, gql, useMutation } from '@apollo/client';
import { decryptFile, testEncryption, testFullProcess } from '../services/crypto';
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

const DOWNLOAD_FILE = gql`
  mutation DownloadFile($downloadId: String!) {
    downloadFile(downloadId: $downloadId) {
      filename
      mimeType
      data
      iv
      salt
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
  const [testResult, setTestResult] = useState('');
  const [fullTestResult, setFullTestResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFileMetadata = async () => {
      try {
        const response = await fetch(`http://localhost:4000/api/metadata/${downloadId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch file metadata');
        }
        const metadata = await response.json();
        console.log('Received metadata:', metadata);
        setFileMetadata(metadata);
        setError('');
      } catch (error) {
        console.error('Metadata fetch error:', error);
        setError(error.message || 'Failed to fetch file information. The file may not exist or may have expired.');
      } finally {
        setLoading(false);
      }
    };

    fetchFileMetadata();
  }, [downloadId]);

  const [downloadFile] = useMutation(DOWNLOAD_FILE, {
    onError: (error) => {
      setError(error.message);
    }
  });

  const handleDownload = async () => {
    try {
      if (!password) {
        setError('Please enter the decryption password');
        return;
      }

      if (!fileMetadata.iv || !fileMetadata.salt) {
        throw new Error('Missing encryption parameters. The file may be corrupted.');
      }

      console.log('Starting download process for file:', downloadId);
      console.log('File metadata:', {
        filename: fileMetadata.filename,
        mimeType: fileMetadata.mimeType,
        size: fileMetadata.size,
        hasIv: !!fileMetadata.iv,
        hasSalt: !!fileMetadata.salt,
        iv: fileMetadata.iv,
        salt: fileMetadata.salt
      });

      setIsDownloading(true);
      setError('');

      // Use fetch to download the encrypted file
      const response = await fetch(`http://localhost:4000/api/download/${downloadId}`, {
        method: 'GET',
        credentials: 'include',
        mode: 'cors'
      });

      // Check if the response is ok
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || 'Failed to download file';
        } catch (e) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Get the encrypted file as an ArrayBuffer
      const encryptedData = await response.arrayBuffer();
      console.log('Encrypted file received:', {
        size: encryptedData.byteLength,
        type: response.headers.get('content-type')
      });

      // Decrypt the file locally
      console.log('Decrypting file with provided password');
      const decryptedData = await decryptFile(
        encryptedData,  // Pass the ArrayBuffer directly
        password,
        fileMetadata.iv,
        fileMetadata.salt
      );
      
      if (!decryptedData) {
        throw new Error('Failed to decrypt file. Please check your password.');
      }

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
      
      console.log('Download and decryption completed successfully');
      
      // Show success message
      setError('Download completed successfully! You can close this page or download the file again.');
      
    } catch (error) {
      console.error('Download error:', error);
      setError(error.message || 'Failed to download or decrypt the file. Please check your password and try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Helper function to convert ArrayBuffer to base64
  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const handleTest = async () => {
    try {
      setTestResult('Running test...');
      const result = await testEncryption();
      setTestResult(result ? 'Test successful!' : 'Test failed - decrypted text did not match');
    } catch (error) {
      setTestResult(`Test failed: ${error.message}`);
      console.error('Test error:', error);
    }
  };

  const handleFullTest = async () => {
    try {
      const result = await testFullProcess();
      setFullTestResult(result);
    } catch (error) {
      console.error('Full process test failed:', error);
      setFullTestResult(false);
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
  
  if (error && !fileMetadata) {
    return (
      <div className="download-page">
        <div className="error-container">
          <h2>File Not Found</h2>
          <p>{error}</p>
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
          <p><strong>Downloads remaining:</strong> {fileMetadata.maxDownloads - fileMetadata.downloadCount}</p>
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

        {error && (
          <div className={`message ${error.includes('successfully') ? 'success-message' : 'error-message'}`}>
            {error}
          </div>
        )}

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

        <button className="primary-button" onClick={() => navigate('/')} style={{ marginTop: '20px' }}>
          Return to Home
        </button>
      </div>
    </div>
  );
};

export default DownloadPage;
