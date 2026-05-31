import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, Smile, MessageSquare, Activity, Camera } from 'lucide-react'

const COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#f59e0b', '#f87171', '#fb7185', '#818cf8']

function StatTile({ icon: Icon, label, value, color = 'brand' }) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-5 h-5 text-${color}-400`} />
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <p className="text-3xl font-bold text-white">{value ?? '—'}</p>
    </div>
  )
}

export default function Dashboard() {
  const nav = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/history/stats')
      .then(r => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Activity className="w-8 h-8 text-brand-400 animate-pulse" />
      </div>
    )
  }

  if (!stats || stats.count === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <TrendingUp className="w-16 h-16 text-gray-700 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">No data yet</h2>
        <p className="text-gray-400 mb-6">Run your first analysis to see trends and charts.</p>
        <button onClick={() => nav('/analyze')} className="px-6 py-2.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition flex items-center gap-2 mx-auto">
          <Camera className="w-4 h-4" /> Start Analysis
        </button>
      </div>
    )
  }

  const { count, avg_mood, emotion_distribution, sentiment_distribution, mood_trend } = stats

  // Prepare chart data
  const trendData = (mood_trend || []).map(d => ({
    date: new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: d.mood_score,
  }))

  const emotionData = Object.entries(emotion_distribution).map(([name, val]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1), value: val,
  }))

  const sentimentData = Object.entries(sentiment_distribution).map(([name, val]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1), value: val,
  }))

  const moodColor = avg_mood >= 65 ? '#22c55e' : avg_mood >= 35 ? '#f59e0b' : '#ef4444'

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">AI-based wellness trends across your sessions</p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile icon={Activity}     label="Total Analyses" value={count} />
        <StatTile icon={TrendingUp}   label="Avg Mood Score" value={avg_mood} color="green" />
        <StatTile icon={Smile}        label="Top Emotion"
          value={emotionData.sort((a,b) => b.value-a.value)[0]?.name ?? '—'} color="purple" />
        <StatTile icon={MessageSquare} label="Top Sentiment"
          value={sentimentData.sort((a,b) => b.value-a.value)[0]?.name ?? '—'} color="yellow" />
      </div>

      {/* Mood trend line */}
      {trendData.length > 1 && (
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">Mood Score Trend</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
              <Line type="monotone" dataKey="score" stroke={moodColor} strokeWidth={2.5} dot={{ r: 4, fill: moodColor }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Emotion + sentiment charts */}
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">Emotion Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={emotionData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={70} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {emotionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">Sentiment Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={sentimentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                {sentimentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-xs text-gray-600 text-center">
        All values are AI-based estimates. Not a medical, dermatological, or psychological diagnosis.
      </p>
    </div>
  )
}
