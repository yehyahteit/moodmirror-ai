/**
 * useFaceApi — loads face-api.js models once and exposes a `ready` flag.
 * Models must exist in /public/models/ (run download-models.cjs first).
 */
import { useState, useEffect } from 'react'
import * as faceapi from 'face-api.js'

let loaded = false

export function useFaceApi() {
  const [ready, setReady] = useState(loaded)

  useEffect(() => {
    if (loaded) return
    const MODEL_URL = '/models'
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    ]).then(() => {
      loaded = true
      setReady(true)
    }).catch(err => {
      console.warn('face-api models failed to load:', err.message)
      // App still works — landmarks just won't show
    })
  }, [])

  return ready
}

/**
 * Draw 68-point landmark mesh onto a canvas.
 * Draws: jaw, eyebrows, nose, eyes (with iris), lips — in distinct colours.
 */
export function drawLandmarks(canvas, detections) {
  if (!canvas || !detections) return
  const ctx = canvas.getContext('2d')

  // Scale proportionally to canvas pixel width so landmarks look right
  // regardless of whether the canvas is 300px or 1280px
  const s     = canvas.width / 400
  const lineW = Math.max(1, 1.2 * s)
  const dotR  = Math.max(0.8, 0.9 * s)  // keep dots small so lines are visible

  detections.forEach(det => {
    const pts = det.landmarks.positions

    // Face bounding box
    const box = det.detection.box
    ctx.strokeStyle = 'rgba(56,189,248,0.6)'
    ctx.lineWidth   = lineW * 1.2
    ctx.setLineDash([Math.max(5, 5 * s), Math.max(3, 3 * s)])
    ctx.strokeRect(box.x, box.y, box.width, box.height)
    ctx.setLineDash([])

    const groups = [
      { pts: pts.slice(0, 17),  color: '#94a3b8', close: false },  // jaw
      { pts: pts.slice(17, 22), color: '#a78bfa', close: false },  // left brow
      { pts: pts.slice(22, 27), color: '#a78bfa', close: false },  // right brow
      { pts: pts.slice(27, 36), color: '#38bdf8', close: false },  // nose
      { pts: pts.slice(36, 42), color: '#34d399', close: true  },  // left eye
      { pts: pts.slice(42, 48), color: '#34d399', close: true  },  // right eye
      { pts: pts.slice(48, 60), color: '#f472b6', close: true  },  // outer lip
      { pts: pts.slice(60, 68), color: '#fb923c', close: true  },  // inner lip
    ]

    // Draw lines first, then dots on top (so dots don't cover lines)
    groups.forEach(({ pts: gpts, color, close }) => {
      if (!gpts.length) return
      ctx.beginPath()
      ctx.moveTo(gpts[0].x, gpts[0].y)
      for (let i = 1; i < gpts.length; i++) ctx.lineTo(gpts[i].x, gpts[i].y)
      if (close) ctx.closePath()
      ctx.strokeStyle = color
      ctx.lineWidth   = lineW
      ctx.lineJoin    = 'round'
      ctx.stroke()
    })

    // Small dots on top
    pts.forEach(pt => {
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, dotR, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.fill()
    })
  })
}
