import { useNavigate } from 'react-router-dom'
import { useRef, useEffect, useState } from 'react'
import * as faceapi from 'face-api.js'
import { useResult } from '../context/ResultContext'
import { useFaceApi, drawLandmarks } from '../hooks/useFaceApi'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'
import { AlertTriangle, RefreshCw, BarChart2, Sparkles, Heart, Eye, Smile, User, MessageSquare, Info, ShoppingBag, Star, ExternalLink } from 'lucide-react'

const EMOTION_EMOJI = { happy: '😊', sad: '😢', angry: '😠', neutral: '😐', fear: '😨', surprise: '😲', disgust: '🤢' }
const SENTIMENT_COLOR = { positive: 'text-green-400', negative: 'text-red-400', neutral: 'text-yellow-400' }

// ── XAI: how each skin metric is computed ────────────────────────────────────
const SKIN_EXPLANATIONS = {
  brightness: {
    label: 'Brightness',
    how: 'Average luminance of all pixels in the face region (0–255), normalised to 0–100.',
    interpret: v => v >= 60 ? 'Well-lit or bright complexion visible in this image.'
                 : v >= 35 ? 'Moderate lighting or slightly dull appearance detected.'
                 : 'Low luminance — may indicate poor lighting, darker complexion, or shadows.',
    rate: v => v >= 60 ? 'Good' : v >= 35 ? 'Neutral' : 'Bad',
  },
  redness: {
    label: 'Redness',
    how: 'Difference between the mean red channel and mean green channel in the face region, scaled 0–100. Higher = more red dominance visible.',
    interpret: v => v > 50 ? 'Noticeable red-channel dominance detected — could reflect lighting, skin tone, or visible redness.'
                 : v > 25 ? 'Mild red-channel elevation visible in the image.'
                 : 'Low redness signal — balanced colour channels in the face region.',
    rate: v => v <= 20 ? 'Good' : v <= 40 ? 'Neutral' : 'Bad',
  },
  texture: {
    label: 'Texture',
    how: 'Laplacian variance of the grayscale face region. Measures sharpness/roughness of surface detail. Higher = more visible texture.',
    interpret: v => v > 60 ? 'High surface detail detected — could indicate skin texture, stubble, or image sharpness.'
                 : v > 20 ? 'Moderate texture — typical for most faces at normal camera distance.'
                 : 'Low texture signal — smooth appearance or soft-focus image.',
    rate: v => v <= 20 ? 'Good' : v <= 50 ? 'Neutral' : 'Bad',
  },
  dark_circles: {
    label: 'Dark Circles',
    how: 'Darkness estimate of the lower 30% of the face region (average luminance inverted). Higher = darker lower-face area.',
    interpret: v => v > 55 ? 'Darker lower-face area detected — may reflect shadows, under-eye area, or lighting angle.'
                 : v > 35 ? 'Mild darkness in lower face region.'
                 : 'Lower face area appears well-lit in this image.',
    rate: v => v <= 30 ? 'Good' : v <= 50 ? 'Neutral' : 'Bad',
  },
  wellness_score: {
    label: 'Overall Wellness Score',
    how: 'Weighted blend: Brightness×0.30 + (100−Redness)×0.25 + (100−Texture)×0.25 + (100−DarkCircles)×0.20.',
    interpret: v => v >= 65 ? 'Combined pixel metrics suggest a well-lit, balanced face in this image.'
                 : v >= 40 ? 'Moderate composite score — some metrics are elevated.'
                 : 'Lower composite score — review individual metrics and lighting conditions.',
    rate: v => v >= 65 ? 'Good' : v >= 40 ? 'Neutral' : 'Bad',
  },
}

const RATE_STYLE = {
  Good:    { text: 'text-green-400',  bg: 'bg-green-400/10  border-green-400/30',  dot: 'bg-green-400'  },
  Neutral: { text: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30', dot: 'bg-yellow-400' },
  Bad:     { text: 'text-red-400',    bg: 'bg-red-400/10    border-red-400/30',    dot: 'bg-red-400'    },
}

// ── UAE Skincare Product Database ────────────────────────────────────────────
const UAE_CREAMS = [
  {
    name: 'CeraVe Moisturizing Cream',
    brand: 'CeraVe',
    price: 'AED 28–115',
    rating: 4.8,
    reviews: '92,000+',
    tags: ['dryness', 'sensitive', 'texture', 'dark_circles'],
    why: 'Ceramides + hyaluronic acid restore the skin barrier and lock in moisture.',
    link: 'https://www.noon.com/uae-en/search/?q=cerave+moisturizing+cream',
    store: 'Noon UAE',
    badge: 'Dermatologist #1',
  },
  {
    name: 'Neutrogena Hydro Boost Water Gel',
    brand: 'Neutrogena',
    price: 'AED 40–65',
    rating: 4.7,
    reviews: '55,000+',
    tags: ['brightness', 'oily', 'lightweight', 'redness'],
    why: 'Oil-free hyaluronic acid gel — ideal for UAE heat. Plumps skin and improves luminance.',
    link: 'https://www.noon.com/uae-en/search/?q=neutrogena+hydro+boost',
    store: 'Noon UAE',
    badge: 'Best for UAE Climate',
  },
  {
    name: 'La Roche-Posay Toleriane Double Repair',
    brand: 'La Roche-Posay',
    price: 'AED 60–90',
    rating: 4.8,
    reviews: '38,000+',
    tags: ['redness', 'sensitive', 'texture', 'dark_circles'],
    why: 'Niacinamide + ceramides calm redness and even out skin tone.',
    link: 'https://www.lifepharmacy.com/search?q=la+roche+posay+toleriane',
    store: 'Life Pharmacy UAE',
    badge: 'Best for Redness',
  },
  {
    name: 'Olay Regenerist Micro-Sculpting Cream',
    brand: 'Olay',
    price: 'AED 50–80',
    rating: 4.6,
    reviews: '61,000+',
    tags: ['brightness', 'dark_circles', 'aging'],
    why: 'Niacinamide + peptides brighten and reduce the look of dark areas over time.',
    link: 'https://www.carrefouruae.com/mafuae/en/search/?q=olay+regenerist',
    store: 'Carrefour UAE',
    badge: 'Best Value',
  },
  {
    name: 'Cetaphil Moisturizing Cream',
    brand: 'Cetaphil',
    price: 'AED 35–60',
    rating: 4.7,
    reviews: '49,000+',
    tags: ['sensitive', 'dryness', 'texture'],
    why: 'Ultra-gentle formula for sensitive skin. Reduces dry-skin texture without irritation.',
    link: 'https://www.noon.com/uae-en/search/?q=cetaphil+moisturizing+cream',
    store: 'Noon UAE',
    badge: 'Sensitive Skin',
  },
  {
    name: 'The Ordinary Natural Moisturizing Factors',
    brand: 'The Ordinary',
    price: 'AED 25–40',
    rating: 4.5,
    reviews: '28,000+',
    tags: ['brightness', 'dryness', 'texture', 'redness'],
    why: 'Amino acids + hyaluronic acid + ceramides. Minimal ingredients, maximum hydration.',
    link: 'https://www.noon.com/uae-en/search/?q=the+ordinary+natural+moisturizing',
    store: 'Noon UAE',
    badge: 'Most Affordable',
  },
  {
    name: 'Garnier Bright Complete Vitamin C Serum Cream',
    brand: 'Garnier',
    price: 'AED 20–35',
    rating: 4.4,
    reviews: '22,000+',
    tags: ['brightness', 'dark_circles'],
    why: 'Vitamin C targets dullness and dark spots. Budget pick for brightening.',
    link: 'https://www.carrefouruae.com/mafuae/en/search/?q=garnier+bright+complete',
    store: 'Carrefour UAE',
    badge: 'Budget Pick',
  },
]

// Pick creams relevant to the user's worst-rated metrics
function getSkincareRecs(skinWellness) {
  const bad    = []
  const neutral = []

  const checks = {
    brightness:   SKIN_EXPLANATIONS.brightness.rate(skinWellness.brightness),
    redness:      SKIN_EXPLANATIONS.redness.rate(skinWellness.redness),
    texture:      SKIN_EXPLANATIONS.texture.rate(skinWellness.texture),
    dark_circles: SKIN_EXPLANATIONS.dark_circles.rate(skinWellness.dark_circles),
  }

  Object.entries(checks).forEach(([key, rating]) => {
    if (rating === 'Bad')     bad.push(key)
    if (rating === 'Neutral') neutral.push(key)
  })

  const priority = [...bad, ...neutral]

  // Score each cream by how many priority tags it covers
  const scored = UAE_CREAMS.map(cream => ({
    ...cream,
    score: cream.tags.filter(t => priority.includes(t)).length,
  })).filter(c => c.score > 0).sort((a, b) => b.score - a.score || b.rating - a.rating)

  // Return top 3, or if nothing matches (all Good), return top rated 2
  return scored.length > 0 ? scored.slice(0, 3) : UAE_CREAMS.slice(0, 2)
}

// ── Skin zones relative to the detected face box (anatomically placed) ───────
// Zones only appear if the metric is above threshold; positions are relative
// to the actual DeepFace face_region bounding box.
const SKIN_ZONE_DEFS = [
  // Whole face — brightness
  {
    key: 'brightness', label: 'Brightness', color: 'rgba(56,189,248,0.18)', border: '#38bdf8',
    rx: 0.0, ry: 0.0, rw: 1.0, rh: 1.0,
    threshold: v => v < 50,
  },
  // Cheeks / mid-face — redness
  {
    key: 'redness', label: 'Redness', color: 'rgba(239,68,68,0.28)', border: '#ef4444',
    rx: 0.10, ry: 0.35, rw: 0.80, rh: 0.35,
    threshold: v => v > 25,
  },
  // Forehead + cheeks — texture
  {
    key: 'texture', label: 'Texture', color: 'rgba(234,179,8,0.25)', border: '#eab308',
    rx: 0.15, ry: 0.10, rw: 0.70, rh: 0.55,
    threshold: v => v > 20,
  },
  // Lower face / under-eyes — dark circles (left eye area)
  {
    key: 'dark_circles', label: 'Dark Circles', color: 'rgba(99,102,241,0.32)', border: '#818cf8',
    rx: 0.08, ry: 0.38, rw: 0.36, rh: 0.18,
    threshold: v => v > 35,
  },
  // Right eye area
  {
    key: 'dark_circles', label: '', color: 'rgba(99,102,241,0.32)', border: '#818cf8',
    rx: 0.56, ry: 0.38, rw: 0.36, rh: 0.18,
    threshold: v => v > 35,
  },
]

function SkinOverlayCanvas({ imageSrc, skinWellness, faceRegion }) {
  const canvasRef = useRef(null)
  const faceReady = useFaceApi()

  useEffect(() => {
    if (!imageSrc || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const img    = new Image()
    img.onload = async () => {
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)

      // Use DeepFace face_region if available, else full image
      const fx = faceRegion?.x ?? 0
      const fy = faceRegion?.y ?? 0
      const fw = faceRegion?.w ?? img.naturalWidth
      const fh = faceRegion?.h ?? img.naturalHeight

      // Draw face bounding box
      if (faceRegion) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth   = 2
        ctx.setLineDash([8, 4])
        ctx.strokeRect(fx, fy, fw, fh)
        ctx.setLineDash([])
        ctx.font      = 'bold 11px Inter, sans-serif'
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.fillText('AI-detected face region', fx + 4, fy - 5)
      }

      const drawnLabels = new Set()
      SKIN_ZONE_DEFS.forEach(zone => {
        const val = skinWellness[zone.key]
        if (val === undefined || !zone.threshold(val)) return

        const zx = fx + zone.rx * fw
        const zy = fy + zone.ry * fh
        const zw = zone.rw * fw
        const zh = zone.rh * fh

        // Filled overlay
        ctx.fillStyle = zone.color
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(zx, zy, zw, zh, 6)
        else ctx.rect(zx, zy, zw, zh)
        ctx.fill()

        // Dashed border
        ctx.strokeStyle = zone.border
        ctx.lineWidth   = 1.5
        ctx.setLineDash([5, 3])
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(zx, zy, zw, zh, 6)
        else ctx.rect(zx, zy, zw, zh)
        ctx.stroke()
        ctx.setLineDash([])

        // Label badge (once per key)
        if (zone.label && !drawnLabels.has(zone.key)) {
          drawnLabels.add(zone.key)
          const txt  = `${zone.label}: ${val.toFixed(1)}`
          const pad  = 5
          ctx.font   = `bold ${Math.max(10, Math.round(fw * 0.04))}px Inter, sans-serif`
          const tw   = ctx.measureText(txt).width
          const th   = Math.max(10, Math.round(fw * 0.04))

          // Badge background
          ctx.fillStyle = 'rgba(0,0,0,0.65)'
          ctx.beginPath()
          if (ctx.roundRect) ctx.roundRect(zx + 4, zy + 4, tw + pad * 2, th + pad * 1.5, 4)
          else ctx.rect(zx + 4, zy + 4, tw + pad * 2, th + pad * 1.5)
          ctx.fill()

          // Badge text
          ctx.fillStyle   = '#ffffff'
          ctx.shadowColor = 'rgba(0,0,0,0.6)'
          ctx.shadowBlur  = 3
          ctx.fillText(txt, zx + 4 + pad, zy + 4 + th)
          ctx.shadowBlur  = 0
        }
      })
      // ── Landmark overlay on results photo ──────────────────────────────
      if (faceReady) {
        try {
          const OPTIONS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 })
          const dets = await faceapi.detectAllFaces(img, OPTIONS).withFaceLandmarks()
          if (dets.length > 0) drawLandmarks(canvas, dets)
        } catch (_) { /* landmarks optional */ }
      }
    }
    img.src = imageSrc
  }, [imageSrc, skinWellness, faceRegion, faceReady])

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-xl"
      style={{ maxHeight: 340, objectFit: 'contain', background: '#000' }}
    />
  )
}

function MoodGauge({ score }) {
  const color = score >= 65 ? '#22c55e' : score >= 35 ? '#f59e0b' : '#ef4444'
  const label = score >= 65 ? 'Good' : score >= 35 ? 'Moderate' : 'Low'
  const pct   = score / 100
  const r = 70, cx = 90, cy = 90
  const x2  = cx + r * Math.cos(Math.PI - Math.PI * pct)
  const y2  = cy - r * Math.sin(Math.PI * pct)
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 180 100" className="w-48">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#1e293b" strokeWidth="14" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="24" fontWeight="800" fill={color}>{score}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="11" fill="#94a3b8">{label}</text>
      </svg>
      <p className="text-xs text-gray-500 mt-1">Mood Score (AI estimate)</p>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color = 'brand' }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 text-${color}-400`} />
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-bold text-white capitalize">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function Results() {
  const nav = useNavigate()
  const { result, capturedImage } = useResult()

  if (!result) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-400 mb-6">No analysis result yet.</p>
        <button onClick={() => nav('/analyze')} className="px-6 py-2.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition">
          Go to Analysis
        </button>
      </div>
    )
  }

  const { emotion, sentiment, age_range, age_raw, gender_expression, skin_wellness, face_region, mood_score, recommendations, disclaimer, timestamp } = result

  const radarData = Object.entries(emotion.scores || {}).map(([name, value]) => ({
    emotion: name.charAt(0).toUpperCase() + name.slice(1),
    value: Math.round(value),
  }))

  const skinMetrics = [
    { key: 'brightness',    label: 'Brightness',   value: skin_wellness.brightness },
    { key: 'redness',       label: 'Redness',      value: skin_wellness.redness },
    { key: 'texture',       label: 'Texture',       value: skin_wellness.texture },
    { key: 'dark_circles',  label: 'Dark Circles', value: skin_wellness.dark_circles },
    { key: 'wellness_score',label: 'Wellness',     value: skin_wellness.wellness_score },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Your Results</h1>
          <p className="text-gray-500 text-sm mt-1">{new Date(timestamp).toLocaleString()} · AI-based estimate</p>
        </div>
        <button onClick={() => nav('/analyze')}
          className="flex items-center gap-2 px-4 py-2 glass rounded-lg text-gray-300 hover:text-white transition text-sm">
          <RefreshCw className="w-4 h-4" /> New Analysis
        </button>
      </div>

      {/* Disclaimer */}
      <div className="glass rounded-xl p-4 border-l-4 border-yellow-400/60 flex gap-2 text-yellow-200/80 text-sm">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-yellow-400" />
        {disclaimer}
      </div>

      {/* Mood gauge + emotion */}
      <div className="glass rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-center">
        <MoodGauge score={mood_score} />
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Dominant Emotion</p>
            <p className="text-4xl">{EMOTION_EMOJI[emotion.dominant] || '🙂'}</p>
            <p className="text-xl font-bold text-white capitalize mt-1">{emotion.dominant}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Text Sentiment</p>
            <p className={`font-semibold capitalize ${SENTIMENT_COLOR[sentiment.label]}`}>{sentiment.label}</p>
            <p className="text-xs text-gray-600">Polarity: {sentiment.score} · Subjectivity: {sentiment.subjectivity}</p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={User}  label="Est. Age Range" value={age_range}
          sub="⚠️ Low accuracy — AI age models have ±10+ yr error, especially for children & older adults." />
        <StatCard icon={Smile} label="Gender Expr."   value={gender_expression.label}
          sub={gender_expression.confidence != null ? `${gender_expression.confidence}% confidence` : gender_expression.note}
          color="purple" />
        <StatCard icon={Heart} label="Skin Wellness"  value={`${skin_wellness.wellness_score}/100`} color="pink" />
        <StatCard icon={Eye}   label="Brightness"     value={`${skin_wellness.brightness}%`} color="yellow" />
      </div>

      {/* Emotion radar */}
      <div className="glass rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-brand-400" /> Emotion Breakdown
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="emotion" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <Radar dataKey="value" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.25} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Skin Wellness ───────────────────────────────────────────────────── */}
      <div className="glass rounded-2xl p-6 space-y-5">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" /> Skin Wellness
          <span className="text-xs text-gray-500 font-normal ml-1">(AI observation from image pixel analysis)</span>
        </h2>

        {/* Photo with face-region-based overlay */}
        {capturedImage && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Annotated face region
              </p>
              {face_region
                ? <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">Face detected by AI</span>
                : <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">No face detected — full image used</span>
              }
            </div>
            <div className="rounded-xl overflow-hidden bg-black">
              <SkinOverlayCanvas
                imageSrc={capturedImage}
                skinWellness={skin_wellness}
                faceRegion={face_region}
              />
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-2">
              {[
                { bg: 'rgba(56,189,248,0.5)',   label: 'Brightness zone' },
                { bg: 'rgba(239,68,68,0.5)',    label: 'Redness zone' },
                { bg: 'rgba(234,179,8,0.5)',    label: 'Texture zone' },
                { bg: 'rgba(99,102,241,0.5)',   label: 'Dark circle zone' },
              ].map(({ bg, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-3 h-3 rounded-sm" style={{ background: bg }} />
                  {label}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Zones are drawn over the AI-detected face bounding box and represent approximate anatomical regions. They are not clinical measurements.
            </p>
          </div>
        )}

        {/* Metric bars + XAI explanation per metric */}
        <div className="space-y-4">
          {skinMetrics.map(({ key, label, value }) => {
            const pct      = Math.min(100, Math.max(0, value))
            const xai      = SKIN_EXPLANATIONS[key]
            const rating   = xai?.rate(pct) ?? 'Neutral'
            const rs       = RATE_STYLE[rating]
            const barColor = rating === 'Good'    ? 'bg-green-500'
                           : rating === 'Neutral' ? 'bg-yellow-500'
                           : 'bg-red-500'

            return (
              <div key={key} className="bg-white/5 rounded-xl p-4">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="font-medium text-white">{label}</span>
                  <div className="flex items-center gap-2">
                    {/* Rating badge */}
                    <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${rs.bg} ${rs.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${rs.dot}`} />
                      {rating}
                    </span>
                    <span className={`font-bold ${rs.text}`}>{pct.toFixed(1)}</span>
                  </div>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 mb-3">
                  <div className={`h-2 rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                </div>
                {xai && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-300">{xai.interpret(pct)}</p>
                    <div className="flex gap-1.5 mt-1">
                      <Info className="w-3 h-3 text-gray-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-gray-600 italic">{xai.how}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Ethical notice */}
        <div className="flex gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-200/70">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-400" />
          All skin metrics are heuristic estimates derived from pixel colour and contrast statistics in the uploaded image.
          They reflect image characteristics — not a dermatological examination. Lighting, camera quality, angle, and skin
          tone all affect these values. Do not use these results for medical decisions.
        </div>
      </div>

      {/* Recommendations */}
      <div className="glass rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-green-400" /> Personalised Wellness Recommendations
        </h2>
        <ul className="space-y-3">
          {recommendations.map((r, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-300">
              <span className="text-brand-400 font-bold shrink-0">{i + 1}.</span>
              {r}
            </li>
          ))}
        </ul>
      </div>

      {/* ── UAE Skincare Product Recommendations ─────────────────────────────── */}
      {(() => {
        const recs = getSkincareRecs(skin_wellness)
        return (
          <div className="glass rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-pink-400" /> Recommended Skincare — Available in UAE
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Selected based on your skin analysis results. Affordable options with high Google ratings.
              </p>
            </div>

            <div className="space-y-3">
              {recs.map((cream, i) => (
                <div key={cream.name} className="bg-white/5 rounded-xl p-4 flex gap-4 items-start">
                  {/* Rank */}
                  <div className="w-7 h-7 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-pink-400">{i + 1}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <span className="font-semibold text-white text-sm">{cream.name}</span>
                        <span className="ml-2 text-xs text-gray-500">{cream.brand}</span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-300 shrink-0">
                        {cream.badge}
                      </span>
                    </div>

                    {/* Rating + price */}
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs font-bold text-yellow-400">{cream.rating}</span>
                        <span className="text-xs text-gray-600">({cream.reviews} reviews)</span>
                      </div>
                      <span className="text-xs font-semibold text-green-400">{cream.price}</span>
                    </div>

                    {/* Why recommended */}
                    <p className="text-xs text-gray-400 mt-1.5">{cream.why}</p>

                    {/* Buy link */}
                    <a
                      href={cream.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs text-brand-400 hover:text-brand-300 transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Buy on {cream.store}
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-600 flex gap-1.5">
              <AlertTriangle className="w-3 h-3 text-yellow-500/60 mt-0.5 shrink-0" />
              Product suggestions are informational only and not a substitute for dermatological advice.
              Prices are approximate and may vary by retailer.
            </p>
          </div>
        )
      })()}

      {/* CTA */}
      <div className="flex gap-3">
        <button onClick={() => nav('/dashboard')}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-brand-500 to-purple-500 font-semibold text-white hover:opacity-90 transition">
          View Dashboard
        </button>
        <button onClick={() => nav('/history')}
          className="flex-1 py-3 rounded-xl glass font-semibold text-gray-200 hover:bg-white/10 transition">
          View History
        </button>
      </div>
    </div>
  )
}
