// src/components/Navbar.js

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  
  // Listen for scroll events to update navbar style
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    
    // Remove event listener when component unmounts
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);
  
  // Toggle mobile menu state
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  return (
    <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill="currentColor" opacity="0.4" />
              <path d="M17 8.5H15.5V6.5C15.5 5.7 15.13 4.9 14.5 4.29C13.87 3.68 13 3.3 12 3.3C11 3.3 10.13 3.68 9.5 4.29C8.87 4.9 8.5 5.7 8.5 6.5V8.5H7C6.45 8.5 6 8.95 6 9.5V16.5C6 17.05 6.45 17.5 7 17.5H17C17.55 17.5 18 17.05 18 16.5V9.5C18 8.95 17.55 8.5 17 8.5ZM12.5 13.5C12.5 13.78 12.28 14 12 14C11.72 14 11.5 13.78 11.5 13.5V12.5C11.5 12.22 11.72 12 12 12C12.28 12 12.5 12.22 12.5 12.5V13.5ZM13.5 8.5H10.5V6.5C10.5 5.95 10.95 5.5 11.5 5.5H12.5C13.05 5.5 13.5 5.95 13.5 6.5V8.5Z" fill="currentColor" />
            </svg>
          </div>
          <span className="logo-text">Secure File Sharing</span>
        </Link>
        
        <div className="menu-icon" onClick={toggleMobileMenu}>
          <div className={`hamburger ${isMobileMenuOpen ? 'open' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        
        <ul className={`nav-menu ${isMobileMenuOpen ? 'active' : ''}`}>
          <li className="nav-item">
            <Link to="/" className={location.pathname === '/' ? 'nav-link active' : 'nav-link'}>
              Home
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/upload" className={location.pathname === '/upload' ? 'nav-link active' : 'nav-link'}>
              Upload File
            </Link>
          </li>
          <li className="nav-item">
            <a href="https://github.com/team23/secure-file-sharing" 
               className="nav-link" 
               target="_blank" 
               rel="noopener noreferrer">
              GitHub
            </a>
          </li>
        </ul>
        
        <div className="nav-actions">
          <Link to="/upload" className="upload-button">
            Encrypt & Share
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
