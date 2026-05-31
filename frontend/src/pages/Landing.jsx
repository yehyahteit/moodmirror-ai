import { useNavigate } from 'react-router-dom'
import { Smile, Sparkles, ShieldCheck, TrendingUp, Camera, Brain } from 'lucide-react'
import yehyaLogo from '../assets/yehya-logo.svg'

const features = [
  { icon: Smile,       title: 'Emotion Detection',    desc: '7-class emotion estimation from facial cues using AI.' },
  { icon: Brain,       title: 'Mood Scoring',         desc: 'Blended 0–100 mood score from emotion + text + skin.' },
  { icon: Sparkles,    title: 'Skin Wellness',         desc: 'AI-based brightness, redness, texture, and dark-circle observation.' },
  { icon: TrendingUp,  title: 'Trend Dashboard',      desc: 'Charts and history to track your estimated mood over time.' },
  { icon: ShieldCheck, title: 'Privacy First',        desc: 'All analysis runs locally. No data sent to third parties.' },
  { icon: Camera,      title: 'Camera or Upload',     desc: 'Use your webcam or upload any face photo for analysis.' },
]

export default function Landing() {
  const nav = useNavigate()
  return (
    <div className="relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Hero */}
      <section className="relative max-w-4xl mx-auto px-4 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-brand-400 text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" /> AI-Powered Wellness Estimation
        </div>
        <div className="flex items-center justify-center gap-4 mb-6">
          <img src={yehyaLogo} alt="Yehya Logo" className="w-16 h-16" />
          <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight">
            <span className="gradient-text">MoodMirror</span>
            <span className="text-white"> AI</span>
          </h1>
        </div>
        <p className="text-gray-400 text-xl max-w-2xl mx-auto mb-10">
          Capture or upload a face photo. Get an AI-based estimate of your emotion, mood score,
          skin wellness, and personalised recommendations — all from visible cues.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => nav('/analyze')}
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-brand-500 to-purple-500 font-semibold text-white shadow-lg hover:opacity-90 transition text-lg"
          >
            Start Analysis
          </button>
          <button
            onClick={() => nav('/dashboard')}
            className="px-8 py-3.5 rounded-xl glass font-semibold text-gray-200 hover:bg-white/10 transition text-lg"
          >
            View Dashboard
          </button>
        </div>
      </section>

      {/* Disclaimer banner */}
      <section className="max-w-3xl mx-auto px-4 mb-16">
        <div className="glass rounded-xl p-4 border-l-4 border-yellow-400/60 text-yellow-200/80 text-sm">
          <strong className="text-yellow-300">Disclaimer:</strong> This app provides AI-based estimates from visible facial cues,
          text sentiment, and image quality. It is <strong>not</strong> a medical, dermatological, or psychological diagnosis.
          Always consult a qualified professional for health concerns.
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
        <h2 className="text-2xl font-bold text-center text-white mb-10">What MoodMirror Estimates</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass rounded-2xl p-5 hover:bg-white/10 transition">
              <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-brand-400" />
              </div>
              <h3 className="font-semibold text-white mb-1">{title}</h3>
              <p className="text-gray-400 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
