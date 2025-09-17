import type { Metadata } from 'next'
import { Inter, Heebo } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { Providers } from './providers'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

const heebo = Heebo({ 
  subsets: ['hebrew'],
  variable: '--font-heebo',
})

export const metadata: Metadata = {
  title: 'GARF Survey System',
  description: 'Group formation survey and matching system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl" className={`${inter.variable} ${heebo.variable}`}>
      <body className="font-hebrew">
        <Providers>
          {children}
          <Toaster 
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}

