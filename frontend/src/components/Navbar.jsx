import { NavLink } from 'react-router-dom'
import { BarChart2, Clock, Camera, Home } from 'lucide-react'
import yehyaLogo from '../assets/yehya-logo.svg'

const links = [
  { to: '/',          label: 'Home',      icon: Home },
  { to: '/analyze',   label: 'Analyze',   icon: Camera },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart2 },
  { to: '/history',   label: 'History',   icon: Clock },
]

export default function Navbar() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-white/10 h-16">
      <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2">
          <img src={yehyaLogo} alt="Yehya Logo" className="w-8 h-8" />
          <span className="font-bold text-lg gradient-text">MoodMirror AI</span>
        </NavLink>

        {/* Links */}
        <div className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                 ${isActive ? 'bg-brand-500/20 text-brand-400' : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'}`
              }
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
