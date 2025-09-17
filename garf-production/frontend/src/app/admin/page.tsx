'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { api, surveyAPI, adminAPI, groupingAPI } from '@/lib/api'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface Survey {
  id: number
  name: string
  version: number
  is_active: boolean
  created_at: string
  schema_json: any
  ui_config_json: any
}

interface Statistics {
  total_surveys: number
  total_responses: number
  total_participants: number
  total_groups: number
  total_runs: number
}

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'surveys' | 'grouping' | 'export'>('overview')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [surveysRes, statsRes] = await Promise.all([
        surveyAPI.list(),
        adminAPI.getStatistics()
      ])
      setSurveys(surveysRes.data)
      setStatistics(statsRes.data)
    } catch (error) {
      console.error('Error loading admin data:', error)
      toast.error('שגיאה בטעינת נתוני הניהול')
    } finally {
      setLoading(false)
    }
  }

  const createInitialSurvey = async () => {
    try {
      const surveyData = {
        name: "main",
        version: 1,
        schema_json: {
          fields: [
            {
              name: "full_name",
              label: { he: "שם מלא", en: "Full Name" },
              type: "text",
              required: true,
              max_length: 100,
              placeholder: { he: "הכנס את שמך המלא", en: "Enter your full name" }
            },
            {
              name: "email",
              label: { he: "כתובת אימייל", en: "Email Address" },
              type: "email",
              required: true,
              placeholder: { he: "example@email.com", en: "example@email.com" }
            },
            {
              name: "phone",
              label: { he: "מספר טלפון", en: "Phone Number" },
              type: "phone",
              required: false,
              placeholder: { he: "050-1234567", en: "050-1234567" }
            },
            {
              name: "age",
              label: { he: "גיל", en: "Age" },
              type: "number",
              required: true,
              min: 18,
              max: 120
            },
            {
              name: "interests",
              label: { he: "תחומי עניין", en: "Areas of Interest" },
              type: "multi_select",
              required: true,
              options: [
                "טכנולוגיה", "ספורט", "אמנות", "מוזיקה", "ספרות", 
                "מסעות", "בישול", "גינון", "צילום", "משחקים"
              ]
            },
            {
              name: "personality",
              label: { he: "איך היית מתאר את עצמך?", en: "How would you describe yourself?" },
              type: "single_select",
              required: true,
              options: [
                "מוחצן וחברותי", "שקט ומתבונן", "יצירתי ואומנותי", 
                "לוגי ומעשי", "אנרגטי ופעיל", "רגוע ושליו"
              ]
            }
          ]
        },
        ui_config_json: {
          title: { he: "סקר קיבוץ GARF", en: "GARF Grouping Survey" },
          description: { he: "אנא מלא את השאלון הבא כדי שנוכל להתאים לך את הקבוצה הטובה ביותר", en: "Please fill out the following survey so we can match you with the best group" },
          submit_button: { he: "שלח סקר", en: "Submit Survey" }
        }
      }

      await surveyAPI.create(surveyData)
      toast.success('הסקר נוצר בהצלחה!')
      loadData()
    } catch (error: any) {
      console.error('Error creating survey:', error)
      toast.error(error.response?.data?.detail || 'שגיאה ביצירת הסקר')
    }
  }

  const exportData = async (type: 'responses' | 'features' | 'groups' | 'runs') => {
    try {
      const response = await adminAPI[`export${type.charAt(0).toUpperCase() + type.slice(1)}`]()
      
      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${type}_export.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success(`הורדת ${type} הושלמה בהצלחה`)
    } catch (error) {
      console.error(`Error exporting ${type}:`, error)
      toast.error(`שגיאה ביצוא ${type}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              ממשק ניהול GARF
            </h1>
            <p className="text-gray-600">
              ניהול סקרים, מדיניות קיבוץ וצפייה בתוצאות
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', label: 'סקירה כללית' },
                { id: 'surveys', label: 'סקרים' },
                { id: 'grouping', label: 'קיבוץ' },
                { id: 'export', label: 'יצוא נתונים' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="card">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">סקרים</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {statistics?.total_surveys || 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">תגובות</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {statistics?.total_responses || 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">משתתפים</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {statistics?.total_participants || 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">קבוצות</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {statistics?.total_groups || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {surveys.length === 0 && (
                <div className="card text-center">
                  <div className="py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">אין סקרים במערכת</h3>
                    <p className="mt-1 text-sm text-gray-500">צור סקר ראשון כדי להתחיל</p>
                    <div className="mt-6">
                      <button
                        onClick={createInitialSurvey}
                        className="btn-primary"
                      >
                        צור סקר ראשון
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Surveys Tab */}
          {activeTab === 'surveys' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">סקרים</h2>
                <button
                  onClick={createInitialSurvey}
                  className="btn-primary"
                >
                  צור סקר חדש
                </button>
              </div>

              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {surveys.map((survey) => (
                    <li key={survey.id}>
                      <div className="px-4 py-4 flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className={`w-3 h-3 rounded-full ${survey.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {survey.name} (גרסה {survey.version})
                            </div>
                            <div className="text-sm text-gray-500">
                              נוצר ב-{new Date(survey.created_at).toLocaleDateString('he-IL')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            survey.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {survey.is_active ? 'פעיל' : 'לא פעיל'}
                          </span>
                          <button
                            onClick={() => router.push(`/survey`)}
                            className="text-primary-600 hover:text-primary-900 text-sm font-medium"
                          >
                            צפה בסקר
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">יצוא נתונים</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { type: 'responses', label: 'תגובות', description: 'כל התגובות לסקרים' },
                  { type: 'features', label: 'תכונות', description: 'תכונות מחולצות מהתגובות' },
                  { type: 'groups', label: 'קבוצות', description: 'קבוצות שנוצרו' },
                  { type: 'runs', label: 'הרצות', description: 'הרצות קיבוץ' }
                ].map((item) => (
                  <div key={item.type} className="card">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{item.label}</h3>
                        <p className="text-sm text-gray-500">{item.description}</p>
                      </div>
                      <button
                        onClick={() => exportData(item.type as any)}
                        className="btn-outline"
                      >
                        הורד CSV
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
