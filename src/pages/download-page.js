// src/pages/DownloadPage.js
import '../../style.css';

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { downloadEncryptedFile } from '../services/api';
import { decryptFile } from '../services/crypto';

const DownloadPage = () => {
  const { downloadId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fileInfo, setFileInfo] = useState(null);
  const [password, setPassword] = useState('');
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  
  useEffect(() => {
    const fetchFileInfo = async () => {
      try {
        // 检查链接是否有效
        if (!downloadId || downloadId.length < 8) {
          throw new Error('无效的下载链接');
        }
        
        // 获取文件元数据
        const metadata = await downloadEncryptedFile(downloadId);
        setFileInfo(metadata);
        setError('');
      } catch (err) {
        console.error('获取文件信息失败:', err);
        setError('无法加载文件信息: ' + (err.message || '链接可能已过期或无效'));
      } finally {
        setLoading(false);
      }
    };
    
    fetchFileInfo();
  }, [downloadId]);
  
  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && password) {
      handleDecrypt();
    }
  };
  
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
      
      // 设置下载成功状态
      setDownloadSuccess(true);
      
    } catch (err) {
      console.error('解密失败:', err);
      setDecryptError('解密失败: ' + (err.message || '密码可能不正确'));
    } finally {
      setDecrypting(false);
    }
  };
  
  const handleDownloadAnother = () => {
    // 返回首页
    navigate('/');
  };
  
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    else return (bytes / 1073741824).toFixed(1) + ' GB';
  };
  
  if (loading) {
    return (
      <div className="download-page loading-state">
        <div className="loading-animation">
          <div className="spinner"></div>
        </div>
        <h2>正在获取文件信息...</h2>
        <p>请稍等，我们正在安全地检索您的文件信息</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="download-page error-state">
        <div className="error-icon">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4a8 8 0 100 16 8 8 0 000-16zM2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12z" fill="currentColor" />
            <path d="M13 17h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor" />
          </svg>
        </div>
        <h2>出错了</h2>
        <p className="error-message">{error}</p>
        <div className="error-actions">
          <button className="primary-button" onClick={() => navigate('/')}>
            返回首页
          </button>
          <button className="secondary-button" onClick={() => window.location.reload()}>
            重试
          </button>
        </div>
      </div>
    );
  }
  
  if (downloadSuccess) {
    return (
      <div className="download-page success-state">
        <div className="success-icon">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor" />
          </svg>
        </div>
        <h2>下载成功!</h2>
        <p>您的文件已成功解密并下载到您的设备</p>
        <div className="file-success-details">
          <p><strong>文件名:</strong> {fileInfo.metadata.originalName}</p>
          <p><strong>大小:</strong> {formatFileSize(fileInfo.metadata.originalSize)}</p>
        </div>
        <button className="primary-button" onClick={handleDownloadAnother}>
          下载其他文件
        </button>
      </div>
    );
  }
  
  return (
    <div className="download-page">
      <div className="download-container">
        <div className="file-download-header">
          <div className="lock-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" fill="currentColor" />
            </svg>
          </div>
          <h1>安全文件下载</h1>
          <p className="subtitle">此文件已使用端到端加密保护</p>
        </div>
        
        <div className="file-info-card">
          <div className="file-info-header">文件信息</div>
          <div className="file-info-content">
            <div className="file-info-item">
              <span className="label">文件名:</span>
              <span className="value">{fileInfo.metadata.originalName}</span>
            </div>
            <div className="file-info-item">
              <span className="label">大小:</span>
              <span className="value">{formatFileSize(fileInfo.metadata.originalSize)}</span>
            </div>
            <div className="file-info-item">
              <span className="label">类型:</span>
              <span className="value">{fileInfo.metadata.originalType || '未知'}</span>
            </div>
          </div>
        </div>
        
        <div className="decrypt-section">
          <h2>输入解密密码</h2>
          <p className="decrypt-instructions">请输入文件发送者提供的密码以解密并下载文件</p>
          
          <div className="password-input-container">
            <div className="password-input-wrapper">
              <input
                type={passwordVisible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入解密密码"
                className="password-input"
              />
              <button 
                type="button" 
                className="toggle-password"
                onClick={togglePasswordVisibility}
              >
                {passwordVisible ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" fill="currentColor" />
                  </svg>
                )}
              </button>
            </div>
            <button 
              onClick={handleDecrypt}
              disabled={decrypting || !password}
              className="decrypt-button"
            >
              {decrypting ? (
                <>
                  <span className="spinner-small"></span>
                  解密中...
                </>
              ) : '解密并下载'}
            </button>
          </div>
          
          {decryptError && (
            <div className="error-message">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor" />
              </svg>
              {decryptError}
            </div>
          )}
        </div>
        
        <div className="security-note">
          <div className="security-note-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" fill="currentColor" />
            </svg>
          </div>
          <div className="security-note-content">
            <h3>安全提示</h3>
            <ul>
              <li>文件在您的浏览器中解密，密码不会发送到服务器</li>
              <li>如果您忘记了密码，请联系文件发送者</li>
              <li>下载完成后，我们建议您妥善保管文件</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;
