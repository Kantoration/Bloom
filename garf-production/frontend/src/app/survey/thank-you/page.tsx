import Link from 'next/link'

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg 
              className="w-10 h-10 text-green-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            תודה רבה!
          </h1>
          
          <p className="text-lg text-gray-600 mb-6">
            הסקר שלך נשלח בהצלחה
          </p>
          
          <p className="text-gray-600 mb-8">
            נעבד את התשובות שלך ונשבץ אותך לקבוצה המתאימה ביותר.
            נעדכן אותך ברגע שהקבוצות יהיו מוכנות.
          </p>
          
          <div className="space-y-3">
            <Link 
              href="/"
              className="block w-full btn-primary"
            >
              חזור לדף הבית
            </Link>
            
            <Link 
              href="/survey"
              className="block w-full btn-outline"
            >
              מלא סקר נוסף
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

