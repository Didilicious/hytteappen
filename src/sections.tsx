import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { useLocation } from 'react-router-dom'

export type AppSection = 'hytta' | 'familien'
const SectionContext = createContext<AppSection | null>(null)

export function getRouteSection(pathname: string, search: string): AppSection | null {
  if (pathname === '/' || pathname === '/login') return null
  if (pathname === '/familien' || pathname.startsWith('/familieoversikt') || pathname.startsWith('/booking/event/') || pathname.startsWith('/booking/edit/event/') || pathname === '/booking/new/event') return 'familien'
  if (pathname === '/booking/calendar') {
    const view = new URLSearchParams(search).get('view')
    return view === 'events' ? 'familien' : view === 'bookings' ? 'hytta' : null
  }
  const isBookingDetails = /^\/booking\/(?:edit\/)?[^/]+$/.test(pathname)
    && !['/booking/new', '/booking/edit', '/booking/calendar'].includes(pathname)
  if (pathname === '/hytta' || pathname.startsWith('/guide/') || pathname === '/booking/new/booking' || isBookingDetails) return 'hytta'
  return null
}

export function SectionProvider({ children }: PropsWithChildren) {
  const { pathname, search } = useLocation()
  const [previousSection, setPreviousSection] = useState<AppSection | null>(null)
  const routeSection = getRouteSection(pathname, search)
  const section = pathname === '/' || pathname === '/login' ? null : routeSection ?? previousSection
  useEffect(() => { setPreviousSection(section) }, [section])
  return <SectionContext.Provider value={section}>{children}</SectionContext.Provider>
}

export function useSection() {
  const { pathname, search } = useLocation()
  const section = useContext(SectionContext)
  return getRouteSection(pathname, search) ?? section
}
