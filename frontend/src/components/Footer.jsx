import React from 'react'
import { analytics } from '../services/analytics.js'
import './Footer.css'

const Footer = () => (
  <footer className="site-footer">
    <div className="site-footer-container">
      <span>Homelessness KPI Tracker</span>
      {!analytics.storageAvailable ? (
        <span role="status">Analytics disabled: browser storage unavailable.</span>
      ) : analytics.excluded ? (
        <span>
          Analytics excluded for this browser.{' '}
          <a href="?analytics=on">Allow analytics</a>
        </span>
      ) : (
        <a href="?analytics=off">Exclude this browser from analytics</a>
      )}
      <a
        href="https://github.com/Nick-/debughomelessness.com"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View the GitHub repository (opens in a new tab)"
      >
        View on GitHub
      </a>
    </div>
  </footer>
)

export default Footer
