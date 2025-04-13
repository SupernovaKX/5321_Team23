// src/pages/HomePage.js

import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

const HomePage = () => {
  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              Secure, Private & <span className="gradient-text">Encrypted</span>
              <br />
              File Sharing
            </h1>
            <p className="hero-subtitle">
              Share your files with end-to-end encryption. Your data stays private and secure.
            </p>
            <div className="hero-actions">
              <Link to="/upload" className="btn btn-primary">
                Start Sharing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Why Choose SecureShare?</h2>
            <p className="section-subtitle">Experience secure file sharing like never before</p>
          </div>
          <div className="grid">
            <div className="card feature-card">
              <div className="feature-icon">🔒</div>
              <h3>End-to-End Encryption</h3>
              <p>Your files are encrypted before they leave your device and can only be decrypted by the intended recipient.</p>
            </div>
            <div className="card feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Fast & Reliable</h3>
              <p>Quick upload and download speeds with reliable transfer technology.</p>
            </div>
            <div className="card feature-card">
              <div className="feature-icon">🔑</div>
              <h3>Secure Links</h3>
              <p>Share files with secure, expirable links that you can revoke at any time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">Simple steps to secure file sharing</p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Upload Your File</h3>
              <p>Select the file you want to share and upload it securely.</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Get Secure Link</h3>
              <p>Receive a unique, encrypted link to share with your recipient.</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Share & Download</h3>
              <p>Your recipient can download the file securely using the link.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
