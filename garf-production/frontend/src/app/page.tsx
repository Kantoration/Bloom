import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            מערכת GARF לסקרים וקיבוץ
          </h1>
          <p className="text-xl text-gray-600 mb-12">
            מערכת חכמה ליצירת קבוצות מותאמות אישית על בסיס סקרים מתקדמים
          </p>
          
          <div className="grid md:grid-cols-2 gap-8 mt-16">
            <Link 
              href="/survey"
              className="card hover:shadow-lg transition-shadow duration-300"
            >
              <div className="text-center">
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  מילוי סקר
                </h2>
                <p className="text-gray-600">
                  מלא את הסקר כדי להצטרף לקבוצה המתאימה לך ביותר
                </p>
              </div>
            </Link>
            
            <Link 
              href="/admin"
              className="card hover:shadow-lg transition-shadow duration-300"
            >
              <div className="text-center">
                <div className="w-20 h-20 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  ממשק ניהול
                </h2>
                <p className="text-gray-600">
                  נהל סקרים, הגדר מדיניות קיבוץ וצפה בתוצאות
                </p>
              </div>
            </Link>
          </div>
          
          <div className="mt-16 p-8 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              יתרונות המערכת
            </h3>
            <div className="grid md:grid-cols-3 gap-6 text-right">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">התאמה חכמה</h4>
                <p className="text-sm text-gray-600">
                  אלגוריתם מתקדם שמבטיח התאמה מיטבית בין חברי הקבוצה
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">גמישות מלאה</h4>
                <p className="text-sm text-gray-600">
                  הגדרת כללים וקריטריונים מותאמים אישית לכל סקר
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">שקיפות מלאה</h4>
                <p className="text-sm text-gray-600">
                  הסברים מפורטים על אופן יצירת הקבוצות
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

