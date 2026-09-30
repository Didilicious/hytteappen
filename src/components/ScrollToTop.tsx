import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

function isBackAction(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  const control = target.closest('a, button')
  if (!control) return false
  return control.hasAttribute('data-preserve-scroll')
    || control.classList.contains('back-button')
    || control.textContent?.trim().startsWith('Tilbake') === true
}

export default function ScrollToTop() {
  const location = useLocation()
  const preserveScroll = useRef(false)

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      preserveScroll.current = isBackAction(event.target)
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  useEffect(() => {
    if (preserveScroll.current) {
      preserveScroll.current = false
      return
    }
    window.scrollTo(0, 0)
  }, [location.pathname, location.search])

  return null
}
