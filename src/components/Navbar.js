// src/components/Navbar.js

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/theme.css';
import './navbar-styles.css';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/upload', label: 'Upload' },
  ];

  return (
    <nav className="navbar fade-in">
      <div className="container">
        <div className="navbar-content">
          <Link to="/" className="navbar-brand">
            <span className="brand-icon">🔒</span>
            <span className="brand-text">SecureShare</span>
          </Link>

          {/* Mobile menu button */}
          <button
            className="navbar-toggle"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle navigation"
          >
            <span className={`hamburger ${isMenuOpen ? 'open' : ''}`}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>

          {/* Navigation links */}
          <div className={`navbar-links ${isMenuOpen ? 'open' : ''}`}>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
