import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '연세바로치과 스케줄 관리',
  description: '치과 직원 스케줄 자동 배치 및 연차 관리 시스템',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script src="https://developers.kakao.com/sdk/js/kakao.js" async></script>
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <SessionProvider>
          {children}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  )
}
