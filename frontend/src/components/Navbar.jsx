import React from 'react'
import { Link } from 'react-router-dom'
import './Navbar.css'

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          Homelessness KPI Tracker
        </Link>
        <ul className="navbar-menu">
          <li className="navbar-item">
            <Link to="/#coc-map" className="navbar-link" onClick={() => document.getElementById('coc-map')?.scrollIntoView()}>CoC Map</Link>
          </li>
          <li className="navbar-item">
            <Link to="/" className="navbar-link">Dashboard</Link>
          </li>
          <li className="navbar-item">
            <Link to="/functional-zero" className="navbar-link">Functional Zero</Link>
          </li>
          <li className="navbar-item">
            <a
              href="https://github.com/sponsors/Nick-"
              className="navbar-link navbar-donate"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Donate via GitHub Sponsors (opens in a new tab)"
            >
              Donate
            </a>
          </li>
        </ul>
      </div>
    </nav>
  )
}

export default Navbar
