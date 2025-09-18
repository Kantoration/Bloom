'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { surveyAPI } from '@/lib/api'
import { SurveyField } from '@/components/SurveyField'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface SurveySchema {
  fields: Array<{
    name: string
    label: { he: string; en: string }
    type: 'single_select' | 'multi_select' | 'scale' | 'text' | 'number' | 'email' | 'phone'
    required: boolean
    options?: string[]
    min?: number
    max?: number
    max_length?: number
    placeholder?: { he: string; en: string }
    help_text?: { he: string; en: string }
  }>
}

export default function SurveyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [survey, setSurvey] = useState<any>(null)
  const [surveySchema, setSurveySchema] = useState<SurveySchema | null>(null)
  
  // Load survey
  useEffect(() => {
    loadSurvey()
  }, [])
  
  const loadSurvey = async () => {
    try {
      const response = await surveyAPI.getSchema()
      setSurveySchema(response.data.schema)
    } catch (error) {
      console.error('Error loading survey:', error)
      toast.error('שגיאה בטעינת הסקר')
    } finally {
      setLoading(false)
    }
  }
  
  // Create dynamic Zod schema based on survey fields
  const createZodSchema = (fields: SurveySchema['fields']) => {
    const schemaObject: any = {}
    
    fields.forEach(field => {
      let fieldSchema: any
      
      switch (field.type) {
        case 'email':
          fieldSchema = z.string().email('כתובת אימייל לא תקינה')
          break
        case 'phone':
          fieldSchema = z.string().regex(/^[0-9-+() ]+$/, 'מספר טלפון לא תקין')
          break
        case 'number':
        case 'scale':
          fieldSchema = z.number()
          if (field.min !== undefined) fieldSchema = fieldSchema.min(field.min)
          if (field.max !== undefined) fieldSchema = fieldSchema.max(field.max)
          break
        case 'text':
          fieldSchema = z.string()
          if (field.max_length) fieldSchema = fieldSchema.max(field.max_length)
          break
        case 'single_select':
          fieldSchema = z.string()
          if (field.options) fieldSchema = fieldSchema.refine(
            val => field.options!.includes(val) || isFlexibleAnswer(val),
            'אפשרות לא תקינה'
          )
          break
        case 'multi_select':
          fieldSchema = z.array(z.string())
          break
        default:
          fieldSchema = z.string()
      }
      
      if (!field.required) {
        fieldSchema = fieldSchema.optional()
      }
      
      schemaObject[field.name] = fieldSchema
    })
    
    return z.object(schemaObject)
  }
  
  const isFlexibleAnswer = (value: string) => {
    const flexibleAnswers = ['לא משנה לי', 'גם וגם', 'אין', 'לא חשוב', 'שילוב', 'בין לבין']
    return flexibleAnswers.includes(value)
  }
  
  // Initialize form with dynamic schema
  const form = useForm({
    resolver: surveySchema ? zodResolver(createZodSchema(surveySchema.fields)) : undefined,
  })
  
  const onSubmit = async (data: any) => {
    setSubmitting(true)
    try {
      // Submit response
      await surveyAPI.submit(data)
      
      toast.success('הסקר נשלח בהצלחה!')
      router.push('/survey/thank-you')
    } catch (error: any) {
      console.error('Error submitting survey:', error)
      toast.error(error.response?.data?.message || 'שגיאה בשליחת הסקר')
    } finally {
      setSubmitting(false)
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }
  
  if (!surveySchema) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900">לא נמצא סקר פעיל</h2>
          <p className="mt-2 text-gray-600">אנא פנה למנהל המערכת</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              סקר קיבוץ
            </h1>
            <p className="text-gray-600 mb-8">
              אנא מלא את השאלון הבא
            </p>
            
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {surveySchema.fields.map((field, index) => (
                <SurveyField
                  key={field.name}
                  field={field}
                  register={form.register}
                  errors={form.formState.errors}
                  control={form.control}
                />
              ))}
              
              <div className="pt-6 border-t">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full btn-primary text-lg py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center">
                      <LoadingSpinner className="w-5 h-5 mr-2" />
                      שולח...
                    </span>
                  ) : (
                    'שלח'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

