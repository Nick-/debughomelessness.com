import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// CoC API calls
export const getCocs = async () => {
  const response = await api.get('/api/coc/')
  return response.data
}

export const getCoc = async (cocId) => {
  const response = await api.get(`/api/coc/${cocId}`)
  return response.data
}

export const getCocHistory = async (cocId, years = 5) => {
  const response = await api.get(`/api/coc/${cocId}/history`, { params: { years } })
  return response.data
}

// Metrics API calls
export const getMetrics = async () => {
  const response = await api.get('/api/metrics/')
  return response.data
}

export const getCocMetrics = async (cocId, year) => {
  const response = await api.get(`/api/metrics/coc/${cocId}`, { params: { year } })
  return response.data
}

export const getMetricsByType = async (metricType) => {
  const response = await api.get(`/api/metrics/type/${metricType}`)
  return response.data
}

// Functional Zero API calls
export const getFunctionalZeroStatus = async () => {
  const response = await api.get('/api/functional-zero/')
  return response.data
}

export const getCocFunctionalZeroStatus = async (cocId) => {
  const response = await api.get(`/api/functional-zero/${cocId}`)
  return response.data
}

export const getFunctionalZeroTimeline = async (cocId) => {
  const response = await api.get(`/api/functional-zero/${cocId}/timeline`)
  return response.data
}

export default api
