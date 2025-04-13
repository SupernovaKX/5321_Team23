// src/components/FileDownload.js

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { downloadEncryptedFile, getFileMetadata } from '../services/api';
import { decryptFile } from '../services/crypto';

const FileDownload = () => {
  const { downloadId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fileInfo, setFileInfo] = useState(null);
  const [password, setPassword] = useState('');
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState('');
  
  useEffect(() => {
    const fetchFileInfo = async () => {
      try {
        const metadata = await getFileMetadata(downloadId);
        if (!metadata) {
          throw new Error('File not found');
        }
        
        // Check if file has expired
        if (new Date(metadata.expiresAt) < new Date()) {
          throw new Error('File has expired');
        }
        
        // Check if download limit reached
        if (metadata.downloadCount >= metadata.maxDownloads) {
          throw new Error('Maximum downloads reached');
        }
        
        setFileInfo(metadata);
        setError('');
      } catch (err) {
        setError(err.message || 'Failed to load file information');
      } finally {
        setLoading(false);
      }
    };
    
    fetchFileInfo();
  }, [downloadId]);
  
  const handleDecrypt = async () => {
    if (!password) {
      setDecryptError('Please enter decryption password');
      return;
    }
    
    try {
      setDecrypting(true);
      setDecryptError('');
      
      // Download the encrypted file
      const { encryptedFile } = await downloadEncryptedFile(downloadId);
      
      // Decrypt the file
      const { file, fileName } = await decryptFile(
        encryptedFile,
        {
          iv: fileInfo.iv,
          salt: fileInfo.salt
        },
        password
      );
      
      // Create download link
      const downloadUrl = URL.createObjectURL(file);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = fileInfo.filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
      
    } catch (err) {
      console.error('Decryption failed:', err);
      setDecryptError(err.message || 'Decryption failed. Please check your password.');
    } finally {
      setDecrypting(false);
    }
  };
  
  if (loading) {
    return <div className="loading">Loading file information...</div>;
  }
  
  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <p>Please check your link or contact the file sender for a new link.</p>
      </div>
    );
  }
  
  return (
    <div className="file-download-container">
      <h2>Secure File Download</h2>
      
      <div className="file-info">
        <p><strong>Filename:</strong> {fileInfo.filename}</p>
        <p><strong>Size:</strong> {(fileInfo.size / 1024 / 1024).toFixed(2)} MB</p>
        <p><strong>Expires:</strong> {new Date(fileInfo.expiresAt).toLocaleString()}</p>
        <p><strong>Downloads remaining:</strong> {fileInfo.maxDownloads - fileInfo.downloadCount}</p>
      </div>
      
      <div className="decrypt-section">
        <h3>Enter Decryption Password</h3>
        <p>Please enter the password provided by the sender to decrypt and download the file</p>
        
        <div className="password-input">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter decryption password"
          />
          <button 
            onClick={handleDecrypt}
            disabled={decrypting}
          >
            {decrypting ? 'Decrypting...' : 'Decrypt and Download'}
          </button>
        </div>
        
        {decryptError && <div className="error-message">{decryptError}</div>}
      </div>
      
      <div className="security-note">
        <h3>Security Note</h3>
        <ul>
          <li>Files are decrypted in your browser - the password is never sent to the server</li>
          <li>If you've forgotten the password, please contact the file sender</li>
        </ul>
      </div>
    </div>
  );
};

export default FileDownload;
