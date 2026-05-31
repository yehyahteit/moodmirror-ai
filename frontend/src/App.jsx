import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Landing from './pages/Landing'
import Analysis from './pages/Analysis'
import Results from './pages/Results'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import { ResultProvider } from './context/ResultContext'

export default function App() {
  return (
    <ResultProvider>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' } }} />
      <Navbar />
      <main className="min-h-screen pt-16">
        <Routes>
          <Route path="/"          element={<Landing />} />
          <Route path="/analyze"   element={<Analysis />} />
          <Route path="/results"   element={<Results />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/history"   element={<History />} />
        </Routes>
      </main>
      <Footer />
    </ResultProvider>
  )
}
