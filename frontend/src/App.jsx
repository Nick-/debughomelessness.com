import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { analytics } from './services/analytics'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import DataFreshness from './components/DataFreshness'
import DiscordLink from './components/DiscordLink'
import Dashboard from './pages/Dashboard'
import CoCDetail from './pages/CoCDetail'
import FunctionalZero from './pages/FunctionalZero'
import './App.css'

function TrafficPageView() {
  const { pathname } = useLocation()
  useEffect(() => { analytics.pageView() }, [pathname])
  return null
}

function App() {
  return (
    <Router>
      <TrafficPageView />
      <div className="App">
        <Navbar />
        <main className="main-content">
          <section className="site-mission" aria-labelledby="mission-heading">
            <h2 id="mission-heading">Our mission</h2>
            <p>To provide publicly available real-time data for the purpose of tracking progress towards worldwide functional zero.</p>
            <p className="site-mission-purpose">Because how can we solve this problem without proper data?</p>
            <div className="site-community">
              <div>
                <h3>Help turn data into progress.</h3>
                <p>Join our community on Discord to discuss the data, share ideas, and work together toward functional zero.</p>
              </div>
              <DiscordLink className="site-community-button" />
            </div>
          </section>
          <DataFreshness />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/coc/:cocId" element={<CoCDetail />} />
            <Route path="/functional-zero" element={<FunctionalZero />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  )
}

export default App
