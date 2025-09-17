import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Request interceptor for auth token
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// API functions
export const surveyAPI = {
  list: (params?: any) => api.get('/surveys', { params }),
  get: (id: number) => api.get(`/surveys/${id}`),
  getByName: (name: string, version: string = 'current') => 
    api.get(`/surveys/by-name/${name}`, { params: { version } }),
  create: (data: any) => api.post('/surveys', data),
  activate: (id: number) => api.patch(`/surveys/${id}/activate`),
  deactivate: (id: number) => api.patch(`/surveys/${id}/deactivate`),
}

export const responseAPI = {
  submit: (surveyId: number, data: any) => 
    api.post(`/responses/${surveyId}/submit`, data),
  get: (id: number) => api.get(`/responses/${id}`),
  saveDraft: (surveyId: number, data: any) => 
    api.post(`/responses/${surveyId}/save_draft`, data),
}

export const groupingAPI = {
  // Policies
  createPolicy: (data: any) => api.post('/grouping/policies', data),
  listPolicies: (params?: any) => api.get('/grouping/policies', { params }),
  getPolicy: (id: number) => api.get(`/grouping/policies/${id}`),
  
  // Runs
  createRun: (data: any) => api.post('/grouping/runs', data),
  getRun: (id: number) => api.get(`/grouping/runs/${id}`),
  listRuns: (params?: any) => api.get('/grouping/runs', { params }),
  
  // Groups
  listGroups: (params?: any) => api.get('/grouping/groups', { params }),
  getGroup: (id: number) => api.get(`/grouping/groups/${id}`),
}

export const adminAPI = {
  exportResponses: (params?: any) => 
    api.get('/admin/export/responses.csv', { 
      params, 
      responseType: 'blob' 
    }),
  exportFeatures: (params?: any) => 
    api.get('/admin/export/features.csv', { 
      params, 
      responseType: 'blob' 
    }),
  exportGroups: (params?: any) => 
    api.get('/admin/export/groups.csv', { 
      params, 
      responseType: 'blob' 
    }),
  exportRuns: (params?: any) => 
    api.get('/admin/export/runs.csv', { 
      params, 
      responseType: 'blob' 
    }),
  getStatistics: (params?: any) => 
    api.get('/admin/statistics', { params }),
}

// Health check
export const healthCheck = () => api.get('/health')

