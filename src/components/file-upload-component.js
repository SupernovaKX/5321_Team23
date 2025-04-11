// src/components/FileUpload.js

import React, { useState } from 'react';
import { encryptFile, generatePassword } from '../services/crypto';
import { uploadEncryptedFile } from '../services/api';

const FileUpload = ({ onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files?.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError(''); // 清除之前的错误
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('请选择一个文件上传');
      return;
    }

    try {
      setUploading(true);
      setProgress(10);

      // 生成随机密码
      const password = generatePassword(24);
      setProgress(20);

      // 在浏览器中加密文件
      const { encryptedFile, metadata } = await encryptFile(file, password);
      setProgress(60);

      // 上传加密后的文件到服务器
      const result = await uploadEncryptedFile(encryptedFile, metadata);
      setProgress(100);

      // 组成下载链接
      const downloadUrl = `${window.location.origin}/download/${result.downloadId}`;

      // 通知父组件上传完成
      onUploadComplete({
        downloadUrl,
        password,
        expiresAt: result.expiresAt,
        originalFileName: file.name
      });

      // 重置状态
      setFile(null);
      
    } catch (err) {
      console.error('上传失败:', err);
      setError('文件上传失败: ' + (err.message || '未知错误'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="file-upload-container">
      <h2>安全分享文件</h2>
      <p>所有文件在上传前会在您的浏览器中加密，服务器永远不会看到文件内容或加密密钥</p>
      
      <div className="upload-area">
        <input
          type="file"
          id="file-input"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <label htmlFor="file-input" className="file-input-label">
          {file ? file.name : '选择文件'}
        </label>
        
        {file && (
          <div className="file-info">
            <p>文件名: {file.name}</p>
            <p>大小: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <p>类型: {file.type || '未知'}</p>
          </div>
        )}
        
        <button 
          onClick={handleUpload} 
          disabled={!file || uploading} 
          className="upload-button"
        >
          {uploading ? '上传中...' : '加密并上传'}
        </button>
      </div>
      
      {uploading && (
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          <span>{progress}%</span>
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default FileUpload;
