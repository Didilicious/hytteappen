import { useEffect, useState } from 'react'
import type { GuideImage } from '../../shared/guideImages'

type DriveIconProps = {
  driveIcon?: GuideImage | null
  name: string
  warningLabel: string
}

function warnAboutDriveIcon(message: string) {
  if (import.meta.env.DEV) console.warn(message)
}

export function warnAboutMissingDriveIcons(warningLabel: string) {
  warnAboutDriveIcon(`Kunne ikke laste ${warningLabel} fra Google Drive. Ikonområdene forblir tomme.`)
}

export default function DriveIcon({ driveIcon, name, warningLabel }: DriveIconProps) {
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    setLoadFailed(false)
    if (driveIcon === null) {
      warnAboutDriveIcon(`Fant ikke ${warningLabel} ${name} i Google Drive.`)
    }
  }, [driveIcon, name, warningLabel])

  if (!driveIcon || loadFailed) return null

  return (
    <img
      src={driveIcon.src}
      alt=""
      onError={() => {
        setLoadFailed(true)
        warnAboutDriveIcon(`Kunne ikke laste ${warningLabel} ${name} fra Google Drive.`)
      }}
    />
  )
}
