// src/pages/DownloadPage.js
import '../style.css';

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import FileDownload from '../components/FileDownload';
import '../styles/theme.css';
import './DownloadPage.css';

const DownloadPage = () => {
  const { downloadId } = useParams();
  const [downloadStatus, setDownloadStatus] = useState(null);

  const handleDownloadComplete = (status) => {
    setDownloadStatus(status);
  };

  return (
    <div className="download-page fade-in">
      <div className="container">
        <div className="download-header">
          <h1 className="page-title">Download Your File</h1>
          <p className="page-subtitle">
            Enter the decryption password to securely download your file.
          </p>
        </div>

        <div className="download-container">
          <FileDownload
            fileId={downloadId}
            onDownloadComplete={handleDownloadComplete}
          />
        </div>

        {downloadStatus && (
          <div className={`status-card ${downloadStatus.type}`}>
            <div className="status-icon">
              {downloadStatus.type === 'success' ? '✅' : '❌'}
            </div>
            <div className="status-content">
              <h3>{downloadStatus.title}</h3>
              <p>{downloadStatus.message}</p>
            </div>
          </div>
        )}

        <div className="security-info">
          <h2>Secure Download Process</h2>
          <div className="security-features">
            <div className="security-feature">
              <div className="feature-icon">🔒</div>
              <h3>Local Decryption</h3>
              <p>Files are decrypted in your browser, never on our servers</p>
            </div>
            <div className="security-feature">
              <div className="feature-icon">🔑</div>
              <h3>Password Protected</h3>
              <p>Your password is required to decrypt the file</p>
            </div>
            <div className="security-feature">
              <div className="feature-icon">🚫</div>
              <h3>No Storage</h3>
              <p>We don't store your files or passwords</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;
