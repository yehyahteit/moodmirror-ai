import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import toast from 'react-hot-toast'
import { Clock, Trash2, RefreshCw, Smile, TrendingUp } from 'lucide-react'
import { useResult } from '../context/ResultContext'

const EMOTION_EMOJI = { happy: '😊', sad: '😢', angry: '😠', neutral: '😐', fear: '😨', surprise: '😲', disgust: '🤢' }
const MOOD_COLOR = score => score >= 65 ? 'text-green-400' : score >= 35 ? 'text-yellow-400' : 'text-red-400'

export default function History() {
  const nav = useNavigate()
  const { setResult } = useResult()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  const load = () => {
    setLoading(true)
    api.get('/history')
      .then(r => setRecords(r.data.history || []))
      .catch(() => toast.error('Could not load history.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const clearAll = async () => {
    if (!window.confirm('Clear all history? This cannot be undone.')) return
    setClearing(true)
    try {
      await api.delete('/history')
      setRecords([])
      toast.success('History cleared.')
    } catch {
      toast.error('Failed to clear history.')
    } finally {
      setClearing(false)
    }
  }

  const viewResult = (record) => {
    setResult(record)
    nav('/results')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Clock className="w-8 h-8 text-brand-400 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">History</h1>
          <p className="text-gray-500 text-sm mt-1">{records.length} analyses stored locally</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 glass rounded-lg text-gray-400 hover:text-white transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          {records.length > 0 && (
            <button onClick={clearAll} disabled={clearing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30
                         text-red-400 hover:bg-red-500/20 transition text-sm">
              <Trash2 className="w-4 h-4" /> Clear All
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {records.length === 0 && (
        <div className="text-center py-24">
          <Clock className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 mb-6">No analyses yet. Run your first one!</p>
          <button onClick={() => nav('/analyze')}
            className="px-6 py-2.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition">
            Start Analysis
          </button>
        </div>
      )}

      {/* Records */}
      <div className="space-y-3">
        {records.map((r, i) => (
          <button key={r.id || i} onClick={() => viewResult(r)}
            className="w-full glass rounded-xl p-4 text-left hover:bg-white/10 transition group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{EMOTION_EMOJI[r.emotion?.dominant] || '🙂'}</span>
                <div>
                  <p className="font-semibold text-white capitalize">{r.emotion?.dominant ?? 'unknown'}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(r.timestamp).toLocaleString()} ·{' '}
                    <span className="capitalize">{r.sentiment?.label} sentiment</span>
                  </p>
                  {r.text_input && (
                    <p className="text-xs text-gray-600 mt-0.5 truncate max-w-xs">"{r.text_input}"</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${MOOD_COLOR(r.mood_score)}`}>{r.mood_score}</p>
                <p className="text-xs text-gray-500">mood score</p>
                <p className="text-xs text-brand-400 mt-1 opacity-0 group-hover:opacity-100 transition">View →</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {records.length > 0 && (
        <p className="text-xs text-gray-600 text-center mt-6">
          All results are AI-based estimates. Not medical, dermatological, or psychological diagnoses.
        </p>
      )}
    </div>
  )
}
