// src/pages/HomePage.js

import React from 'react';
import { Link } from 'react-router-dom';

const HomePage = () => {
  return (
    <div className="home-page">
      <div className="hero-section">
        <h1>Secure, Private End-to-End Encrypted File Sharing</h1>
        <p className="subtitle">Files are encrypted in your browser. The server never sees your file content or encryption keys.</p>
        
        <div className="cta-buttons">
          <Link to="/upload" className="primary-button">
            Encrypt & Share Files
          </Link>
        </div>
      </div>
      
      <div className="features-section">
        <h2>Why Choose Our Service?</h2>
        
        <div className="features-grid">
          <div className="feature-card">
            <h3>End-to-End Encryption</h3>
            <p>Files are encrypted using AES-GCM in your browser, ensuring only you and the recipient can access the content</p>
          </div>
          
          <div className="feature-card">
            <h3>Zero-Knowledge Architecture</h3>
            <p>Our servers never see your file contents or encryption keys, even in case of a security breach</p>
          </div>
          
          <div className="feature-card">
            <h3>Separate Links and Passwords</h3>
            <p>Download links and decryption passwords can be shared through different channels for enhanced security</p>
          </div>
          
          <div className="feature-card">
            <h3>Simple to Use</h3>
            <p>No registration or plugins required - just upload files and share links and passwords</p>
          </div>
        </div>
      </div>
      
      <div className="how-it-works-section">
        <h2>How It Works</h2>
        
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Upload File</h3>
            <p>Select the file you want to share in your browser</p>
          </div>
          
          <div className="step">
            <div className="step-number">2</div>
            <h3>Client-Side Encryption</h3>
            <p>Files are encrypted in your browser using strong AES encryption</p>
          </div>
          
          <div className="step">
            <div className="step-number">3</div>
            <h3>Get Link and Password</h3>
            <p>System generates download link and separate decryption password</p>
          </div>
          
          <div className="step">
            <div className="step-number">4</div>
            <h3>Secure Sharing</h3>
            <p>Share the link and password with recipients through separate channels</p>
          </div>
          
          <div className="step">
            <div className="step-number">5</div>
            <h3>Secure Download</h3>
            <p>Recipients download using the link and decrypt locally using the password</p>
          </div>
        </div>
      </div>
      
      <div className="security-section">
        <h2>Security is Our Top Priority</h2>
        <p>Our file sharing system uses multiple layers of security to protect your privacy:</p>
        
        <ul className="security-features">
          <li>AES-GCM encryption in the browser</li>
          <li>Secure random key generation</li>
          <li>TLS 1.3 encrypted transfer</li>
          <li>Zero-knowledge backend - servers never process or store plaintext or keys</li>
          <li>Open source code for security audits</li>
        </ul>
      </div>
    </div>
  );
};

export default HomePage;
