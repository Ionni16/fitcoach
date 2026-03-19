import type { Metadata } from 'next'
import { DM_Sans, Syne, DM_Mono } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })
const syne = Syne({ subsets: ['latin'], variable: '--font-syne' })
const dmMono = DM_Mono({ weight: ['400', '500'], subsets: ['latin'], variable: '--font-dm-mono' })

export const metadata: Metadata = {
  title: 'FitCoach',
  description: 'Gestione allenamenti',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body className={`${dmSans.variable} ${syne.variable} ${dmMono.variable}`}>
        {children}
      </body>
    </html>
  )
}