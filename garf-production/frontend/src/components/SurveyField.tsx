'use client'

import { Control, Controller, FieldErrors, UseFormRegister } from 'react-hook-form'

interface FieldDefinition {
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
}

interface SurveyFieldProps {
  field: FieldDefinition
  register: UseFormRegister<any>
  errors: FieldErrors
  control: Control<any>
}

export function SurveyField({ field, register, errors, control }: SurveyFieldProps) {
  const error = errors[field.name]
  const locale = 'he' // Could be dynamic based on user preference
  
  const renderField = () => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <input
            {...register(field.name)}
            type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
            className="form-input"
            placeholder={field.placeholder?.[locale]}
            maxLength={field.max_length}
          />
        )
      
      case 'number':
        return (
          <input
            {...register(field.name, { valueAsNumber: true })}
            type="number"
            className="form-input"
            min={field.min}
            max={field.max}
            placeholder={field.placeholder?.[locale]}
          />
        )
      
      case 'scale':
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: { onChange, value } }) => (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{field.min}</span>
                  <span>{field.max}</span>
                </div>
                <input
                  type="range"
                  min={field.min}
                  max={field.max}
                  value={value || field.min}
                  onChange={(e) => onChange(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-center text-lg font-semibold">
                  {value || field.min}
                </div>
              </div>
            )}
          />
        )
      
      case 'single_select':
        return (
          <select {...register(field.name)} className="form-input">
            <option value="">בחר אפשרות</option>
            {field.options?.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )
      
      case 'multi_select':
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: { onChange, value = [] } }) => (
              <div className="space-y-2">
                {field.options?.map(option => (
                  <label key={option} className="flex items-center">
                    <input
                      type="checkbox"
                      value={option}
                      checked={value.includes(option)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onChange([...value, option])
                        } else {
                          onChange(value.filter((v: string) => v !== option))
                        }
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-2"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            )}
          />
        )
      
      default:
        return null
    }
  }
  
  return (
    <div className="space-y-2">
      <label className="form-label">
        {field.label[locale]}
        {field.required && <span className="text-red-500 mr-1">*</span>}
      </label>
      
      {field.help_text?.[locale] && (
        <p className="text-sm text-gray-500">{field.help_text[locale]}</p>
      )}
      
      {renderField()}
      
      {error && (
        <p className="form-error">
          {error.message || 'שדה לא תקין'}
        </p>
      )}
    </div>
  )
}

