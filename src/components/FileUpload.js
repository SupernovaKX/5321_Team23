import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { generatePassword, encryptFile } from '../services/crypto';
import '../styles/theme.css';

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
      downloadId
    }
  }
`;

const FileUpload = ({ onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [downloadId, setDownloadId] = useState(null);
  const [maxDownloads] = useState(5);
  const [expiresIn] = useState(604800); // 7 days in seconds
  const [linkCopied, setLinkCopied] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  const [uploadFileMutation] = useMutation(UPLOAD_FILE, {
    onError: (error) => {
      console.error('GraphQL Error:', error);
      setError('An error occurred during upload. Please try again.');
    }
  });

  const handleFileChange = (e) => {
    if (e.target.files?.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError('File size cannot exceed 100MB');
        return;
      }
      setFile(selectedFile);
      setError('');
      setEncryptionKey(null);
      setUploadStatus(null);
      setDownloadId(null);
      setLinkCopied(false);
      setKeyCopied(false);
    }
  };

  const handleUpload = async (file) => {
    try {
      setUploading(true);
      setProgress(0);
      setError('');
      
      const fileBuffer = await file.arrayBuffer();
      const password = generatePassword();
      setEncryptionKey(password);
      
      const { encryptedData, iv, salt } = await encryptFile(fileBuffer, password);
      const encryptedBlob = new Blob([encryptedData], { type: 'application/octet-stream' });
      const encryptedFile = new File([encryptedBlob], file.name, { type: 'application/octet-stream' });

      const { data } = await uploadFileMutation({
        variables: {
          file: encryptedFile,
          originalFilename: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: encryptedData.byteLength,
          iv: iv,
          salt: salt,
          maxDownloads: maxDownloads,
          expiresIn: expiresIn
        }
      });

      if (data?.uploadFile?.success) {
        setUploadStatus('success');
        setDownloadId(data.uploadFile.downloadId);
        if (onUploadComplete) {
          onUploadComplete({
            downloadUrl: `${window.location.origin}/download/${data.uploadFile.downloadId}`,
            downloadId: data.uploadFile.downloadId,
            password: password,
            originalFileName: file.name,
            expiresAt: new Date(Date.now() + expiresIn * 1000)
          });
        }
      }
    } catch (error) {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/download/${downloadId}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(encryptionKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  const formatExpirationDate = () => {
    return new Date(Date.now() + expiresIn * 1000).toLocaleString();
  };

  return (
    <div className="container">
      <div className="card">
        <h2 className="text-center">Secure File Upload</h2>
        <p className="text-center text-secondary">
          Files are encrypted in your browser before upload. The server never sees your unencrypted data.
        </p>
        
        {!uploadStatus && (
          <div className="upload-area">
            <input
              type="file"
              id="file-input"
              onChange={handleFileChange}
              className="hidden"
              disabled={uploading}
            />
            <label htmlFor="file-input" className="button button-secondary">
              {file ? 'Change File' : 'Select File'}
            </label>
            
            {file && (
              <div className="mt-4">
                <div className="file-info">
                  <p><strong>Filename:</strong> {file.name}</p>
                  <p><strong>Size:</strong> {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                
                <button 
                  onClick={() => handleUpload(file)} 
                  disabled={!file || uploading} 
                  className="button button-primary mt-4"
                >
                  {uploading ? 'Encrypting...' : 'Encrypt and Upload'}
                </button>
              </div>
            )}
          </div>
        )}
        
        {uploading && (
          <div className="mt-4">
            <div className="progress-bar">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center mt-2">{progress}%</p>
          </div>
        )}
        
        {error && (
          <div className="alert alert-error mt-4">
            {error}
          </div>
        )}
        
        {uploadStatus === 'success' && (
          <div className="share-section fade-in">
            <div className="alert alert-success">
              <h3>File Successfully Encrypted and Uploaded!</h3>
              <p>Please send the download link and password separately to the recipient.</p>
            </div>
            
            <div className="mt-4">
              <h4>File Information</h4>
              <div className="file-info">
                <p><strong>Filename:</strong> {file?.name}</p>
                <p><strong>Expires:</strong> {formatExpirationDate()}</p>
              </div>
            </div>
            
            {downloadId && (
              <div className="mt-4">
                <h4>Download Link</h4>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={`${window.location.origin}/download/${downloadId}`} 
                    readOnly 
                    className="input"
                  />
                  <button 
                    onClick={handleCopyLink} 
                    className="button button-secondary"
                  >
                    {linkCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
            
            {encryptionKey && (
              <div className="mt-4">
                <h4>Decryption Password</h4>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={encryptionKey} 
                    readOnly 
                    className="input"
                  />
                  <button 
                    onClick={handleCopyKey} 
                    className="button button-secondary"
                  >
                    {keyCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-secondary mt-2">
                  <strong>Security Tip:</strong> Share the password through a different channel
                </p>
              </div>
            )}
            
            <div className="mt-6">
              <button 
                onClick={() => {
                  setFile(null);
                  setUploadStatus(null);
                  setDownloadId(null);
                  setEncryptionKey(null);
                }}
                className="button button-secondary"
              >
                Upload Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;