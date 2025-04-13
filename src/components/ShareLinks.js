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
  
  // Format expiry time
  const formatExpiresAt = (dateString) => {
    if (!dateString) return 'Never Expires';
    const expiryDate = new Date(dateString);
    return expiryDate.toLocaleString();
  };

  return (
    <div className="share-links-container">
      <h2>File Successfully Encrypted and Uploaded!</h2>
      <p>Please send the download link and password separately to the recipient, preferably through different channels</p>
      
      <div className="file-info">
        <p><strong>Filename:</strong> {originalFileName}</p>
        <p><strong>Expires:</strong> {formatExpiresAt(expiresAt)}</p>
      </div>
      
      <div className="link-container">
        <h3>Download Link</h3>
        <div className="copy-field">
          <input type="text" value={downloadUrl} readOnly />
          <button onClick={handleCopyLink}>
            {linkCopied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
        <p className="share-tip">Share this link via email or message</p>
      </div>
      
      <div className="password-container">
        <h3>Decryption Password</h3>
        <div className="copy-field">
          <input type="text" value={password} readOnly />
          <button onClick={handleCopyPassword}>
            {passwordCopied ? 'Copied!' : 'Copy Password'}
          </button>
        </div>
        <p className="share-tip"><strong>Security Tip:</strong> Send the password through a different channel (e.g., phone, SMS)</p>
      </div>
      
      <div className="security-note">
        <h3>Security Notes</h3>
        <ul>
          <li>Download link and password are shown only once, copy them immediately</li>
          <li>For enhanced security, share the link and password through different channels</li>
          <li>Our servers cannot access your file contents or password</li>
        </ul>
      </div>
    </div>
  );
};

export default ShareLinks;
