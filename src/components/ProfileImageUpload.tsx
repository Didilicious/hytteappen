import { useId, useRef, useState } from 'react'
import {
  PROFILE_IMAGE_ACCEPT,
  PROFILE_IMAGE_MAX_BYTES,
  uploadProfileImage,
} from '../profileImages'

type ProfileImageUploadProps = {
  familyId: string
  memberId?: string
  label: string
  onUploaded: (version: string) => void
}

export default function ProfileImageUpload({ familyId, memberId, label, onUploaded }: ProfileImageUploadProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file?: File) {
    if (!file) return
    setMessage(null)
    setError(null)

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Filtypen støttes ikke. Bruk JPEG, PNG eller WebP.')
      return
    }
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      setError('Bildet er for stort. Maksimal filstørrelse er 5 MB.')
      return
    }

    setUploading(true)
    try {
      const version = await uploadProfileImage({ familyId, memberId }, file)
      onUploaded(version)
      setMessage('Bildet er oppdatert.')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Bildet kunne ikke lastes opp. Prøv igjen.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="profile-image-upload">
      <input
        ref={inputRef}
        id={inputId}
        className="profile-image-upload__input"
        type="file"
        accept={PROFILE_IMAGE_ACCEPT}
        disabled={uploading}
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <label className="profile-image-upload__action" htmlFor={inputId} aria-disabled={uploading}>
        {uploading ? 'Laster opp …' : label}
      </label>
      {message && <p className="profile-image-upload__success" role="status">{message}</p>}
      {error && <p className="profile-image-upload__error" role="alert">{error}</p>}
    </div>
  )
}
