import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import * as faceapi from 'face-api.js'
import api from '../api'
import toast from 'react-hot-toast'
import { Camera, Upload, Type, CheckCircle2, Loader2, AlertTriangle, ZoomIn, ShieldCheck, Eye, Smile, ArrowLeftRight } from 'lucide-react'
import { useResult } from '../context/ResultContext'
import { useFaceApi } from '../hooks/useFaceApi'

const TABS = ['Camera', 'Upload', 'Text Only']

const GROUPS = [
  { slice: [0,  17], color: '#94a3b8', close: false }, // jaw
  { slice: [17, 22], color: '#c084fc', close: false }, // left brow
  { slice: [22, 27], color: '#c084fc', close: false }, // right brow
  { slice: [27, 36], color: '#38bdf8', close: false }, // nose
  { slice: [36, 42], color: '#4ade80', close: true  }, // left eye
  { slice: [42, 48], color: '#4ade80', close: true  }, // right eye
  { slice: [48, 60], color: '#f472b6', close: true  }, // outer lip
  { slice: [60, 68], color: '#fb923c', close: true  }, // inner lip
]

// ── Liveness helpers ─────────────────────────────────────────────────────────

// Eye Aspect Ratio: ratio of eye height to width. < 0.2 = closed
function eyeAspectRatio(pts) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  const h1 = dist(pts[1], pts[5])
  const h2 = dist(pts[2], pts[4])
  const w  = dist(pts[0], pts[3])
  return w < 1 ? 1 : (h1 + h2) / (2 * w)
}

// Mouth Aspect Ratio: mouth openness relative to face width
function mouthAspectRatio(pts, faceWidth) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  // outer lip: pts 48–59. Top lip mid = pts[51], bottom lip mid = pts[57]
  const openH = dist(pts[51], pts[57])
  return faceWidth < 1 ? 0 : openH / faceWidth
}

// Nose tip x relative to face center — detects head turn
function noseTurnRatio(pts, faceBox) {
  const noseTip  = pts[30]  // index 30 = nose tip
  const faceCenter = faceBox.x + faceBox.width / 2
  return (noseTip.x - faceCenter) / faceBox.width  // -0.5 … +0.5
}

const CHALLENGES = [
  {
    id: 'blink',
    label: 'Blink your eyes',
    hint: 'Slowly close and open both eyes',
    Icon: Eye,
    color: 'text-sky-400',
    border: 'border-sky-500/40',
    bg: 'bg-sky-500/10',
  },
  {
    id: 'smile',
    label: 'Give a big smile',
    hint: 'Open your mouth into a wide smile',
    Icon: Smile,
    color: 'text-yellow-400',
    border: 'border-yellow-500/40',
    bg: 'bg-yellow-500/10',
  },
  {
    id: 'turn',
    label: 'Turn your head left or right',
    hint: 'Slowly turn your head to one side',
    Icon: ArrowLeftRight,
    color: 'text-purple-400',
    border: 'border-purple-500/40',
    bg: 'bg-purple-500/10',
  },
]

// ── Single-canvas camera: draws video + landmarks together ───────────────────
function LandmarkCamera({ onCapture }) {
  const canvasRef  = useRef(null)
  const videoRef   = useRef(null)
  const rafRef     = useRef(null)
  const streamRef  = useRef(null)
  const faceReady  = useFaceApi()

  const [camError,    setCamError]    = useState(null)
  const [status,      setStatus]      = useState('Starting camera…')
  const [hasFace,     setHasFace]     = useState(false)
  const [livenessPassed, setLivenessPassed] = useState(false)
  const [challenge,   setChallenge]   = useState(null)   // current CHALLENGES entry
  const [progress,    setProgress]    = useState(0)       // 0–100 fill for progress bar

  const lastDetsRef    = useRef([])
  const faceReadyRef   = useRef(false)
  const livenessRef    = useRef({ passed: false, blinkCount: 0, eyeWasClosed: false,
                                  smileDetected: false, turnDetected: false,
                                  baseNoseX: null, progressVal: 0 })

  // Keep ref in sync
  useEffect(() => { faceReadyRef.current = faceReady }, [faceReady])

  // Pick a random challenge on mount
  useEffect(() => {
    const c = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]
    setChallenge(c)
  }, [])

  // ── Start camera stream ──
  useEffect(() => {
    const vid = document.createElement('video')
    vid.autoplay    = true
    vid.muted       = true
    vid.playsInline = true
    videoRef.current = vid

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(stream => {
        streamRef.current = stream
        vid.srcObject = stream
        vid.play()
        setStatus('Camera ready — loading AI models…')
      })
      .catch(() => setCamError('Camera access denied. Please allow camera permissions.'))

    return () => {
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // ── Detection + liveness loop ──
  useEffect(() => {
    const OPTIONS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.25 })
    let active = true

    const detect = async () => {
      if (!active) return
      const vid = videoRef.current
      if (faceReadyRef.current && vid && vid.readyState >= 2 && vid.videoWidth > 0) {
        try {
          const dets = await faceapi.detectAllFaces(vid, OPTIONS).withFaceLandmarks()
          lastDetsRef.current = dets
          const hasFaceNow = dets.length > 0
          setHasFace(hasFaceNow)
          setStatus(hasFaceNow ? 'AI Landmarks Active' : 'AI Active — no face')

          // ── Liveness evaluation ──
          const state = livenessRef.current
          if (!state.passed && hasFaceNow && challenge) {
            const det  = dets[0]
            const pts  = det.landmarks.positions
            const box  = det.detection.box

            if (challenge.id === 'blink') {
              const leftEAR  = eyeAspectRatio(pts.slice(36, 42))
              const rightEAR = eyeAspectRatio(pts.slice(42, 48))
              const avgEAR   = (leftEAR + rightEAR) / 2
              const closed   = avgEAR < 0.20

              if (closed && !state.eyeWasClosed) {
                state.eyeWasClosed = true
              } else if (!closed && state.eyeWasClosed) {
                state.eyeWasClosed = false
                state.blinkCount++
                state.progressVal = Math.min(100, state.blinkCount * 100)
                setProgress(state.progressVal)
                if (state.blinkCount >= 1) {
                  state.passed = true
                  setLivenessPassed(true)
                }
              }
            }

            if (challenge.id === 'smile') {
              const mar = mouthAspectRatio(pts, box.width)
              state.progressVal = Math.min(100, (mar / 0.12) * 100)
              setProgress(state.progressVal)
              if (mar > 0.12) {
                state.passed = true
                setLivenessPassed(true)
              }
            }

            if (challenge.id === 'turn') {
              const ratio = noseTurnRatio(pts, box)
              if (state.baseNoseX === null) state.baseNoseX = ratio
              const delta = Math.abs(ratio - state.baseNoseX)
              state.progressVal = Math.min(100, (delta / 0.18) * 100)
              setProgress(state.progressVal)
              if (delta > 0.18) {
                state.passed = true
                setLivenessPassed(true)
              }
            }
          }
        } catch (_) {}
      }
      if (active) setTimeout(detect, 80)
    }

    detect()
    return () => { active = false }
  }, [challenge])   // re-run if challenge changes (reset button)

  // ── Draw loop: RAF renders video + cached detections ──
  useEffect(() => {
    const loop = () => {
      const vid    = videoRef.current
      const canvas = canvasRef.current
      if (!vid || !canvas) { rafRef.current = requestAnimationFrame(loop); return }
      if (vid.readyState < 2) { rafRef.current = requestAnimationFrame(loop); return }

      const vw = vid.videoWidth
      const vh = vid.videoHeight
      if (!vw || !vh) { rafRef.current = requestAnimationFrame(loop); return }

      canvas.width  = vw
      canvas.height = vh
      canvas.style.width  = '100%'
      canvas.style.height = 'auto'

      const ctx = canvas.getContext('2d')
      ctx.save()
      ctx.translate(vw, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(vid, 0, 0, vw, vh)
      ctx.restore()

      const dets = lastDetsRef.current
      if (dets && dets.length > 0) {
        const scale   = vw / 400
        const lineW   = Math.max(2, 1.8 * scale)
        const dotR    = Math.max(3, 2.5 * scale)
        const dashOn  = Math.max(6, 5 * scale)
        const dashOff = Math.max(3, 2.5 * scale)

        dets.forEach(det => {
          const pts = det.landmarks.positions
          const mx  = x => vw - x

          const b = det.detection.box
          ctx.strokeStyle = livenessRef.current.passed
            ? 'rgba(34,197,94,0.9)'    // green when passed
            : 'rgba(56,189,248,0.9)'
          ctx.lineWidth   = lineW * 1.2
          ctx.setLineDash([dashOn, dashOff])
          ctx.strokeRect(mx(b.x + b.width), b.y, b.width, b.height)
          ctx.setLineDash([])

          GROUPS.forEach(({ slice, color, close }) => {
            const gpts = pts.slice(slice[0], slice[1])
            if (!gpts.length) return
            ctx.beginPath()
            ctx.moveTo(mx(gpts[0].x), gpts[0].y)
            gpts.slice(1).forEach(p => ctx.lineTo(mx(p.x), p.y))
            if (close) ctx.closePath()
            ctx.strokeStyle = color
            ctx.lineWidth   = lineW
            ctx.lineJoin    = 'round'
            ctx.stroke()
          })

          pts.forEach(p => {
            ctx.beginPath()
            ctx.arc(mx(p.x), p.y, dotR, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(255,255,255,0.9)'
            ctx.fill()
          })
        })
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // Reset challenge
  const resetChallenge = useCallback(() => {
    const c = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]
    setChallenge(c)
    setLivenessPassed(false)
    setProgress(0)
    livenessRef.current = { passed: false, blinkCount: 0, eyeWasClosed: false,
                            smileDetected: false, turnDetected: false,
                            baseNoseX: null, progressVal: 0 }
  }, [])

  // ── Capture: draw a CLEAN frame (no landmarks) then crop to face ──
  const capture = useCallback(() => {
    if (!livenessPassed) return toast.error('Complete the liveness check first.')
    const vid = videoRef.current
    if (!vid || vid.readyState < 2) return toast.error('Camera not ready.')

    const vw = vid.videoWidth
    const vh = vid.videoHeight

    // Draw clean mirrored video frame — no landmark overlay
    const clean = document.createElement('canvas')
    clean.width  = vw
    clean.height = vh
    const cctx = clean.getContext('2d')
    cctx.save()
    cctx.translate(vw, 0)
    cctx.scale(-1, 1)
    cctx.drawImage(vid, 0, 0, vw, vh)
    cctx.restore()

    // Crop to face bounding box + padding
    let cx = 0, cy = 0, cw = vw, ch = vh
    if (lastDetsRef.current.length > 0) {
      const best = lastDetsRef.current.reduce((a, b) =>
        a.detection.score > b.detection.score ? a : b)
      const b   = best.detection.box
      const pad = 60
      const mx  = x => vw - x
      const bx  = mx(b.x + b.width)
      cx = Math.max(0, bx - pad)
      cy = Math.max(0, b.y - pad)
      cw = Math.min(vw - cx, b.width  + pad * 2)
      ch = Math.min(vh - cy, b.height + pad * 2)
    }

    const out = document.createElement('canvas')
    out.width  = cw
    out.height = ch
    out.getContext('2d').drawImage(clean, cx, cy, cw, ch, 0, 0, cw, ch)
    out.toBlob(blob => {
      const dataUrl = out.toDataURL('image/jpeg', 0.93)
      const file    = new File([blob], 'face-capture.jpg', { type: 'image/jpeg' })
      onCapture(dataUrl, file)
    }, 'image/jpeg', 0.93)
  }, [livenessPassed, onCapture])

  if (camError) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
      <AlertTriangle className="w-8 h-8 text-yellow-400" />
      <p className="text-gray-400 text-sm">{camError}</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden bg-black">
        <canvas ref={canvasRef} className="w-full rounded-xl block" />

        {/* Status badges */}
        <div className="absolute top-2 left-2 flex gap-2 pointer-events-none">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            faceReady
              ? 'bg-green-500/20 border-green-500/40 text-green-400'
              : 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
          }`}>{status}</span>
          {hasFace && faceReady && (
            <span className="text-xs bg-brand-500/20 border border-brand-500/40 text-brand-400 px-2 py-0.5 rounded-full flex items-center gap-1">
              <ZoomIn className="w-3 h-3" /> Face detected
            </span>
          )}
          {livenessPassed && (
            <span className="text-xs bg-green-500/20 border border-green-500/40 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Live
            </span>
          )}
        </div>
      </div>

      {/* ── Liveness challenge card ── */}
      {faceReady && challenge && (
        livenessPassed ? (
          <div className="flex items-center gap-3 rounded-xl p-3 bg-green-500/10 border border-green-500/30">
            <ShieldCheck className="w-5 h-5 text-green-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-400">Liveness verified ✓</p>
              <p className="text-xs text-gray-500">You can now capture your photo.</p>
            </div>
            <button onClick={resetChallenge}
              className="text-xs text-gray-500 hover:text-gray-300 transition underline">
              Reset
            </button>
          </div>
        ) : (
          <div className={`rounded-xl p-4 border ${challenge.border} ${challenge.bg} space-y-2`}>
            <div className="flex items-center gap-2">
              <challenge.Icon className={`w-4 h-4 ${challenge.color} shrink-0`} />
              <p className={`text-sm font-semibold ${challenge.color}`}>
                Liveness Check: {challenge.label}
              </p>
            </div>
            <p className="text-xs text-gray-400">{challenge.hint}</p>
            {/* Progress bar */}
            <div className="w-full bg-white/10 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  progress > 80 ? 'bg-green-400' : progress > 40 ? 'bg-yellow-400' : 'bg-brand-400'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <button onClick={resetChallenge}
              className="text-xs text-gray-600 hover:text-gray-400 transition underline">
              Try a different challenge
            </button>
          </div>
        )
      )}

      {/* Landmark legend */}
      {faceReady && (
        <div className="flex flex-wrap gap-3 text-xs">
          {[
            { color: '#94a3b8', label: 'Jaw' },
            { color: '#c084fc', label: 'Brows' },
            { color: '#38bdf8', label: 'Nose' },
            { color: '#4ade80', label: 'Eyes' },
            { color: '#f472b6', label: 'Lips' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-gray-400">
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={capture}
        disabled={!livenessPassed}
        className={`w-full py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2
          ${livenessPassed
            ? 'bg-brand-600 hover:bg-brand-700 text-white'
            : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/10'
          }`}
      >
        {livenessPassed
          ? <><Camera className="w-4 h-4" />{hasFace ? 'Capture Face (cropped)' : 'Capture Full Frame'}</>
          : <><ShieldCheck className="w-4 h-4" />Complete liveness check to capture</>
        }
      </button>
    </div>
  )
}

// ── Main Analysis Page ────────────────────────────────────────────────────────
export default function Analysis() {
  const nav = useNavigate()
  const { setResult, setCapturedImage } = useResult()

  const [tab,     setTab]     = useState(0)
  const [consent, setConsent] = useState(false)
  const [text,    setText]    = useState('')
  const [preview, setPreview] = useState(null)
  const [fileObj, setFileObj] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleCameraCapture = useCallback((dataUrl, file) => {
    setPreview(dataUrl)
    setFileObj(file)
  }, [])

  const onDrop = useCallback(accepted => {
    const f = accepted[0]
    if (!f) return
    setFileObj(f)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target.result)
    reader.readAsDataURL(f)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, maxFiles: 1,
  })

  const handleSubmit = async () => {
    if (!consent) return toast.error('Please give consent before proceeding.')
    if (tab !== 2 && !fileObj) return toast.error('Please capture or upload a photo first.')

    let uploadFile = fileObj
    if (tab === 2) {
      if (!text.trim()) return toast.error('Please enter some text.')
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 100
      canvas.getContext('2d').fillRect(0, 0, 100, 100)
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg'))
      uploadFile = new File([blob], 'blank.jpg', { type: 'image/jpeg' })
    }

    const form = new FormData()
    form.append('file', uploadFile)
    form.append('text', text)
    form.append('consent', 'true')

    setLoading(true)
    try {
      const { data } = await api.post('/analyze', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
      setCapturedImage(preview)
      nav('/results')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Analysis failed. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">New Analysis</h1>
      <p className="text-gray-400 mb-8">Provide a face photo and/or text to receive your AI-based wellness estimate.</p>

      <div className="flex gap-2 mb-6">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => { setTab(i); setPreview(null); setFileObj(null) }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition
              ${tab === i ? 'bg-brand-500 text-white' : 'glass text-gray-400 hover:text-white'}`}>
            {i === 0 && <Camera className="w-4 h-4" />}
            {i === 1 && <Upload className="w-4 h-4" />}
            {i === 2 && <Type   className="w-4 h-4" />}
            {t}
          </button>
        ))}
      </div>

      <div className="glass rounded-2xl p-6 space-y-5">

        {tab === 0 && (
          preview ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Captured — face cropped with landmarks</p>
              <img src={preview} alt="Captured" className="w-full rounded-xl object-cover max-h-72" />
              <button onClick={() => { setPreview(null); setFileObj(null) }}
                className="w-full py-2.5 glass rounded-lg text-gray-300 hover:text-white transition">
                Retake
              </button>
            </div>
          ) : (
            <LandmarkCamera onCapture={handleCameraCapture} />
          )
        )}

        {tab === 1 && (
          preview ? (
            <div className="space-y-3">
              <img src={preview} alt="Preview" className="w-full rounded-xl object-cover max-h-64" />
              <button onClick={() => { setPreview(null); setFileObj(null) }}
                className="w-full py-2.5 glass rounded-lg text-gray-300 hover:text-white transition">Remove</button>
            </div>
          ) : (
            <div {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition
                ${isDragActive ? 'border-brand-400 bg-brand-500/10' : 'border-gray-600 hover:border-gray-400'}`}>
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">Drag & drop a photo, or <span className="text-brand-400 underline">browse</span></p>
              <p className="text-gray-600 text-xs mt-1">JPG, PNG, WEBP supported</p>
            </div>
          )
        )}

        {tab === 2 && (
          <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex gap-2 text-yellow-200 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            Text-only mode skips face analysis. Emotion and skin wellness will show defaults.
          </div>
        )}

        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">How are you feeling? (optional)</label>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="e.g. I feel anxious about my presentation today..."
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-gray-200
                       placeholder-gray-600 focus:outline-none focus:border-brand-500 resize-none transition" />
        </div>

        <label className="flex items-start gap-3 cursor-pointer" onClick={() => setConsent(c => !c)}>
          <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition
            ${consent ? 'bg-brand-500 border-brand-500' : 'border-gray-500 hover:border-gray-300'}`}>
            {consent && <CheckCircle2 className="w-4 h-4 text-white" />}
          </div>
          <span className="text-sm text-gray-400">
            I consent to AI analysis of my photo and/or text. I understand this is an AI-based estimate,{' '}
            <strong className="text-gray-300">not a medical, dermatological, or psychological diagnosis.</strong>
          </span>
        </label>

        <button onClick={handleSubmit} disabled={loading || !consent}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-500 to-purple-500 font-semibold text-white
                     hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Analysing…</> : 'Run Analysis'}
        </button>
      </div>
    </div>
  )
}
