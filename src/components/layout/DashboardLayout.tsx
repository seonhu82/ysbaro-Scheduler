'use client'

import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { Footer } from './Footer'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 bg-gray-50">
          <div className="p-6">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
