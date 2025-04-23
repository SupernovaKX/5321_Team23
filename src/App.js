// src/App.js

import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { createUploadLink } from 'apollo-upload-client';
import { ApolloClient, InMemoryCache } from '@apollo/client';

// Import components
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import DownloadPage from './pages/DownloadPage';
import NotFoundPage from './pages/NotFoundPage';
import Navbar from './components/Navbar';

// Create Apollo Client
const client = new ApolloClient({
  link: createUploadLink({
    uri: process.env.REACT_APP_GRAPHQL_ENDPOINT,
    credentials: 'include',
    headers: {
      'Apollo-Require-Preflight': 'true'
    },
    fetchOptions: {
      mode: 'cors',
      credentials: 'include'
    }
  }),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all'
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all'
    },
    mutate: {
      errorPolicy: 'all'
    }
  }
});

function App() {
  return (
    <ApolloProvider client={client}>
      <Router>
        <div className="app">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/download/:downloadId" element={<DownloadPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <footer className="footer">
            <p>&copy; {new Date().getFullYear()} Secure End-to-End File Sharing | Team 23</p>
            <p>Protected by End-to-End Encryption Technology</p>
          </footer>
        </div>
      </Router>
    </ApolloProvider>
  );
}

export default App;
