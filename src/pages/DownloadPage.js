// src/pages/DownloadPage.js
import '../style.css';

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, gql, useMutation } from '@apollo/client';
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

  const [downloadFile] = useMutation(DOWNLOAD_FILE, {
    onError: (error) => {
      setError(error.message);
    }
  });

  const handleDownload = async () => {
    try {
      console.log('Starting download process for file:', downloadId);
      console.log('File metadata:', {
        filename: fileMetadata.filename,
        mimeType: fileMetadata.mimeType,
        size: fileMetadata.size,
        hasIv: !!fileMetadata.iv,
        hasSalt: !!fileMetadata.salt
      });

      setIsDownloading(true);
      setError('');

      // Use fetch to download the file
      const response = await fetch(`http://localhost:4000/api/download/${downloadId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
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

      const fileData = await response.json();
      console.log('File data received:', {
        filename: fileData.filename,
        mimeType: fileData.mimeType,
        hasData: !!fileData.data,
        hasIv: !!fileData.iv,
        hasSalt: !!fileData.salt
      });

      const { filename, mimeType, data: base64Data, iv, salt } = fileData;
      
      if (!base64Data || !iv || !salt) {
        console.error('Missing required data:', { 
          hasFileData: !!base64Data, 
          hasIv: !!iv, 
          hasSalt: !!salt 
        });
        throw new Error('Invalid file data received from server');
      }

      // Convert base64 to binary data
      console.log('Converting base64 to binary data...');
      const binaryData = atob(base64Data);
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }

      // Convert the Uint8Array to ArrayBuffer for decryption
      const encryptedArrayBuffer = bytes.buffer;

      // Log the data sizes for debugging
      console.log('Data sizes:', {
        base64Length: base64Data.length,
        binaryLength: binaryData.length,
        bytesLength: bytes.length,
        arrayBufferSize: encryptedArrayBuffer.byteLength
      });

      // Decrypt the file
      console.log('Decrypting file with provided password');
      console.log('Decryption parameters:', {
        hasEncryptedData: !!encryptedArrayBuffer,
        encryptedDataSize: encryptedArrayBuffer.byteLength,
        hasIv: !!iv,
        hasSalt: !!salt,
        passwordLength: password.length,
        passwordFirstChar: password.charAt(0),
        passwordLastChar: password.charAt(password.length - 1)
      });

      // Log the IV and salt for debugging
      console.log('IV and Salt:', {
        ivLength: iv.length,
        saltLength: salt.length,
        ivFirstChar: iv.charAt(0),
        saltFirstChar: salt.charAt(0)
      });

      const decryptedData = await decryptFile(encryptedArrayBuffer, password, iv, salt);
      
      if (!decryptedData) {
        console.error('Decryption failed: No data returned from decryptFile');
        throw new Error('Failed to decrypt file. Please check your password.');
      }
      
      // Create a blob from the decrypted data
      console.log('Creating download blob');
      const blob = new Blob([decryptedData], { type: mimeType });
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('Download completed successfully');
      
      // Navigate to success page or show success message
      navigate('/download/success');
    } catch (error) {
      console.error('Download error:', error);
      setError(error.message || 'Failed to download or decrypt the file. Please check your password and try again.');
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
