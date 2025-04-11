// src/components/ShareLinks.js

import React, { useState } from 'react';

const ShareLinks = ({ downloadUrl, password, expiresAt, originalFileName }) => {
  const [linkCopied, setLinkCopied] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(downloadUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };
  
  const handleCopyPassword = () => {
    navigator.clipboard.writeText(password);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };
  
  // 格式化过期时间
  const formatExpiresAt = (dateString) => {
    if (!dateString) return '永不过期';
    const expiryDate = new Date(dateString);
    return expiryDate.toLocaleString();
  };

  return (
    <div className="share-links-container">
      <h2>文件已成功加密并上传!</h2>
      <p>请分别发送下载链接和密码给接收者，建议使用不同的渠道发送</p>
      
      <div className="file-info">
        <p><strong>文件名:</strong> {originalFileName}</p>
        <p><strong>过期时间:</strong> {formatExpiresAt(expiresAt)}</p>
      </div>
      
      <div className="link-container">
        <h3>下载链接</h3>
        <div className="copy-field">
          <input type="text" value={downloadUrl} readOnly />
          <button onClick={handleCopyLink}>
            {linkCopied ? '已复制!' : '复制链接'}
          </button>
        </div>
        <p className="share-tip">通过电子邮件或消息发送此链接</p>
      </div>
      
      <div className="password-container">
        <h3>解密密码</h3>
        <div className="copy-field">
          <input type="text" value={password} readOnly />
          <button onClick={handleCopyPassword}>
            {passwordCopied ? '已复制!' : '复制密码'}
          </button>
        </div>
        <p className="share-tip"><strong>安全提示:</strong> 使用不同的通信渠道发送密码 (如电话、短信)</p>
      </div>
      
      <div className="security-note">
        <h3>安全提示</h3>
        <ul>
          <li>下载链接和密码仅显示一次，请立即复制</li>
          <li>为提高安全性，请使用不同渠道分享链接和密码</li>
          <li>我们的服务器无法访问您的文件内容或密码</li>
        </ul>
      </div>
    </div>
  );
};

export default ShareLinks;
