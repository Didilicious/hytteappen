import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  getProfileImageUrl,
  getProfileImageVersion,
  subscribeToProfileImageVersion,
} from '../profileImages'
import ProfilePlaceholder from './ProfilePlaceholder'

type ProfileImageProps = {
  familyId: string
  memberId?: string
  variant: 'family' | 'member'
  alt: string
  version?: string
  className?: string
}

export default function ProfileImage({ familyId, memberId, variant, alt, version, className }: ProfileImageProps) {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToProfileImageVersion({ familyId, memberId }, listener),
    [familyId, memberId],
  )
  const getSnapshot = useCallback(
    () => getProfileImageVersion({ familyId, memberId }),
    [familyId, memberId],
  )
  const currentVersion = useSyncExternalStore(subscribe, getSnapshot, () => undefined)
  const source = getProfileImageUrl({ familyId, memberId }, version ?? currentVersion)
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [source])

  return (
    <span className={`profile-image profile-image--${variant}${className ? ` ${className}` : ''}`}>
      <ProfilePlaceholder variant={variant} />
      {!failed && <img src={source} alt={alt} onError={() => setFailed(true)} />}
    </span>
  )
}
