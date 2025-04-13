// src/pages/UploadPage.js

import React, { useState } from 'react';
import FileUpload from '../components/FileUpload';
import '../styles/theme.css';
import './UploadPage.css';

const UploadPage = () => {
  const [uploadStatus, setUploadStatus] = useState(null);

  const handleUploadComplete = (status) => {
    setUploadStatus(status);
  };

  return (
    <div className="upload-page">
      <div className="upload-header">
        <div className="container">
          <h1 className="page-title">
            Upload & <span className="gradient-text">Share</span> Files
          </h1>
          <p className="page-subtitle">
            Your files are encrypted before they leave your device. Only you and your recipient can access them.
          </p>
        </div>
      </div>

      <div className="container">
        <div className="upload-container">
          <FileUpload onUploadComplete={handleUploadComplete} />
        </div>

        {uploadStatus && (
          <div className={`status-card ${uploadStatus.type}`}>
            <div className="status-icon">
              {uploadStatus.type === 'success' ? '✅' : '❌'}
            </div>
            <div className="status-content">
              <h3>{uploadStatus.title}</h3>
              <p>{uploadStatus.message}</p>
              {uploadStatus.link && (
                <div className="status-actions">
                  <a
                    href={uploadStatus.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                  >
                    Open Download Page
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="security-info">
          <div className="container">
            <h2>How We Protect Your Files</h2>
            <div className="security-features">
              <div className="security-feature">
                <div className="feature-icon">🔒</div>
                <h3>End-to-End Encryption</h3>
                <p>Files are encrypted in your browser before upload</p>
              </div>
              <div className="security-feature">
                <div className="feature-icon">🔑</div>
                <h3>Secure Key Generation</h3>
                <p>Unique encryption keys for each file</p>
              </div>
              <div className="security-feature">
                <div className="feature-icon">🚫</div>
                <h3>Zero-Knowledge</h3>
                <p>We never see your files or encryption keys</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
