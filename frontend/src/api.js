/**
 * Axios instance pre-configured with the backend base URL.
 * In dev: Vite proxy handles /analyze and /history → localhost:8000
 * In production: VITE_API_URL env var points to the Railway backend URL
 */
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
})

export default api
