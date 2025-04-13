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
      downloadId
      filename
      originalFilename
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
  query DownloadFile($downloadId: String!) {
    downloadFile(downloadId: $downloadId) {
      downloadId
      filename
      originalFilename
      mimeType
      size
      iv
      salt
      content
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
    if (!password) {
      setError('请输入解密密码');
      return;
    }

    try {
      setIsDownloading(true);
      setError('');
      
      // 获取文件数据
      const { data } = await downloadFile({
        variables: { downloadId }
      });

      if (!data || !data.downloadFile) {
        throw new Error('文件不存在或已过期');
      }

      const fileData = data.downloadFile;
      
      // 解密文件
      const decryptedFile = await decryptFile({
        encryptedContent: fileData.content,
        iv: fileData.iv,
        salt: fileData.salt,
        password,
        originalName: fileData.originalFilename,
        mimeType: fileData.mimeType
      });

      // 创建下载链接
      const blob = new Blob([decryptedFile], { type: fileData.mimeType });
      const url = window.URL.createObjectURL(blob);
      
      // 触发下载
      const a = document.createElement('a');
      a.href = url;
      a.download = fileData.originalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // 清理
      window.URL.revokeObjectURL(url);
      setDownloadSuccess(true);

    } catch (error) {
      console.error('Download error:', error);
      setError(error.message || '下载失败，请重试');
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
