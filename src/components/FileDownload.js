// src/components/FileDownload.js

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { downloadEncryptedFile } from '../services/api';
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
        // 只获取文件元数据，此时还不下载实际文件
        const metadata = await downloadEncryptedFile(downloadId);
        setFileInfo(metadata);
        setError('');
      } catch (err) {
        setError('无法加载文件信息: ' + (err.message || '链接可能已过期或无效'));
      } finally {
        setLoading(false);
      }
    };
    
    fetchFileInfo();
  }, [downloadId]);
  
  const handleDecrypt = async () => {
    if (!password) {
      setDecryptError('请输入解密密码');
      return;
    }
    
    try {
      setDecrypting(true);
      setDecryptError('');
      
      // 解密文件
      const { file, fileName } = await decryptFile(
        fileInfo.encryptedFile,
        fileInfo.metadata,
        password
      );
      
      // 创建下载链接
      const downloadUrl = URL.createObjectURL(file);
      
      // 创建一个临时链接并模拟点击以下载文件
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // 释放URL对象
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
      
    } catch (err) {
      console.error('解密失败:', err);
      setDecryptError('解密失败: ' + (err.message || '密码可能不正确'));
    } finally {
      setDecrypting(false);
    }
  };
  
  if (loading) {
    return <div className="loading">加载文件信息...</div>;
  }
  
  if (error) {
    return (
      <div className="error-container">
        <h2>出错了</h2>
        <p>{error}</p>
        <p>请检查您的链接是否完整，或联系文件发送者获取新链接。</p>
      </div>
    );
  }
  
  return (
    <div className="file-download-container">
      <h2>安全文件下载</h2>
      
      <div className="file-info">
        <p><strong>文件名:</strong> {fileInfo.metadata.originalName}</p>
        <p><strong>大小:</strong> {(fileInfo.metadata.originalSize / 1024 / 1024).toFixed(2)} MB</p>
      </div>
      
      <div className="decrypt-section">
        <h3>输入解密密码</h3>
        <p>请输入发送者提供的密码以解密并下载文件</p>
        
        <div className="password-input">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入解密密码"
          />
          <button 
            onClick={handleDecrypt}
            disabled={decrypting}
          >
            {decrypting ? '解密中...' : '解密并下载'}
          </button>
        </div>
        
        {decryptError && <div className="error-message">{decryptError}</div>}
      </div>
      
      <div className="security-note">
        <h3>安全提示</h3>
        <ul>
          <li>文件在您的浏览器中解密，密码不会发送到服务器</li>
          <li>如果您忘记了密码，请联系文件发送者</li>
        </ul>
      </div>
    </div>
  );
};

export default FileDownload;
