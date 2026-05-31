/**
 * Run once: node download-models.cjs
 * Downloads face-api.js model weights into public/models/
 */
const https = require('https')
const fs    = require('fs')
const path  = require('path')

const DEST = path.join(__dirname, 'public', 'models')
fs.mkdirSync(DEST, { recursive: true })

const BASE = 'https://github.com/justadudewhohacks/face-api.js/raw/master/weights'

const FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_landmark_68_tiny_model-weights_manifest.json',
  'face_landmark_68_tiny_model-shard1',
]

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const get = (u) => {
      https.get(u, res => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          get(res.headers.location)
          return
        }
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve() })
      }).on('error', reject)
    }
    get(url)
  })
}

;(async () => {
  for (const f of FILES) {
    const url  = `${BASE}/${f}`
    const dest = path.join(DEST, f)
    process.stdout.write(`Downloading ${f} ... `)
    await download(url, dest)
    console.log('done')
  }
  console.log('\nAll models downloaded to public/models/')
})()
