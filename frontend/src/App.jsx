import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import DataFreshness from './components/DataFreshness'
import Dashboard from './pages/Dashboard'
import CoCDetail from './pages/CoCDetail'
import FunctionalZero from './pages/FunctionalZero'
import './App.css'

function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />
        <main className="main-content">
          <DataFreshness />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/coc/:cocId" element={<CoCDetail />} />
            <Route path="/functional-zero" element={<FunctionalZero />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
