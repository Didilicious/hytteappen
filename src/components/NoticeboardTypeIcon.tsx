import type { NoticeboardPostType } from '../../shared/noticeboard'

export default function NoticeboardTypeIcon({ type }: { type: NoticeboardPostType }) {
  if (type === 'Info') {
    return (
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 10v6M12 7.5h.01" />
      </svg>
    )
  }

  if (type === 'Spørsmål') {
    return (
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M8.8 9a3.3 3.3 0 1 1 5.5 2.45c-1.25 1.1-2.3 1.45-2.3 3.05M12 18h.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="m7.5 12.5 3 3 6-7" />
      <rect x="4" y="4" width="16" height="16" rx="3" />
    </svg>
  )
}
