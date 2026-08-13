import { useEffect, useState } from 'react'
import { getProfileImageUrl } from '../profileImages'
import ProfilePlaceholder from './ProfilePlaceholder'

type ProfileImageProps = {
  familyId: string
  memberId?: string
  variant: 'family' | 'member'
  alt: string
  version?: string
}

export default function ProfileImage({ familyId, memberId, variant, alt, version }: ProfileImageProps) {
  const source = getProfileImageUrl({ familyId, memberId }, version)
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [source])

  return (
    <span className={`profile-image profile-image--${variant}`}>
      <ProfilePlaceholder variant={variant} />
      {!failed && <img src={source} alt={alt} onError={() => setFailed(true)} />}
    </span>
  )
}
