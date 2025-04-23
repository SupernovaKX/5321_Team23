// src/pages/DownloadPage.js
import '../style.css';

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, gql } from '@apollo/client';
import { decryptFile } from '../services/crypto';
import './DownloadPage.css';

const GET_FILE_METADATA = gql`
  query GetFileMetadata($downloadId: String!) {
    getFileMetadata(downloadId: $downloadId) {
      downloadId
      filename
      mimeType
      size
      iv
      salt
      expiresAt
    }
  }
`;

const DOWNLOAD_FILE = gql`
  mutation DownloadFile($downloadId: String!, $password: String!) {
    downloadFile(downloadId: $downloadId, password: $password) {
      success
      message
      file {
        downloadId
        filename
        mimeType
        data
        iv
        salt
      }
    }
  }
`;

const DownloadPage = () => {
  const { downloadId } = useParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const { loading: metadataLoading, data: metadataData } = useQuery(GET_FILE_METADATA, {
    variables: { downloadId }
  });

  const [downloadFileMutation] = useMutation(DOWNLOAD_FILE);

  const handleDownload = async () => {
    if (!password) {
      setError('请输入解密密码');
      return;
    }

    try {
      setDownloading(true);
      setError('');

      const { data } = await downloadFileMutation({
        variables: {
          downloadId,
          password
        }
      });

      if (!data?.downloadFile?.success) {
        throw new Error(data?.downloadFile?.message || '下载失败');
      }

      const { file } = data.downloadFile;
      
      // 解密文件
      const decryptedData = await decryptFile({
        encryptedData: file.data,
        iv: file.iv,
        salt: file.salt,
        password
      });

      // 创建下载链接
      const blob = new Blob([decryptedData], { type: file.mimeType });
      const url = URL.createObjectURL(blob);
      
      // 触发下载
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // 清理
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('下载错误:', error);
      setError(error.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="download-page">
      <h2>文件下载</h2>
      
      {metadataLoading ? (
        <div className="loading">加载中...</div>
      ) : metadataData?.getFileMetadata ? (
        <div className="file-info">
          <h3>文件信息</h3>
          <p><strong>文件名:</strong> {metadataData.getFileMetadata.filename}</p>
          <p><strong>大小:</strong> {(metadataData.getFileMetadata.size / 1024 / 1024).toFixed(2)} MB</p>
          <p><strong>类型:</strong> {metadataData.getFileMetadata.mimeType}</p>
          <p><strong>过期时间:</strong> {new Date(metadataData.getFileMetadata.expiresAt).toLocaleString()}</p>
        </div>
      ) : (
        <div className="error-message">找不到文件信息</div>
      )}
      
      <div className="password-section">
        <div className="input-group">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入解密密码"
            disabled={downloading}
          />
          <button 
            onClick={handleDownload}
            disabled={downloading || !password || !metadataData?.getFileMetadata}
          >
            {downloading ? '正在下载...' : '下载并解密'}
          </button>
        </div>
        
        {downloading && (
          <div className="download-status">
            <div className="progress-message">正在处理文件，请稍候...</div>
          </div>
        )}
        
        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={() => setError('')}>清除错误</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DownloadPage;
