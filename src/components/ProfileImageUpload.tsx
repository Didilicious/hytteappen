import { useId, useRef, useState } from 'react'
import { PROFILE_IMAGE_ACCEPT, uploadProfileImage } from '../profileImages'
import { validateProfileImageSource } from '../profileImageProcessing'
import ProfileImageCropDialog from './ProfileImageCropDialog'

type ProfileImageUploadProps = {
  familyId: string
  memberId?: string
  label: string
  onUploaded: (version: string) => void
}

export default function ProfileImageUpload({ familyId, memberId, label, onUploaded }: ProfileImageUploadProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFile(file?: File) {
    if (!file) return
    setMessage(null)
    setError(null)

    try {
      validateProfileImageSource(file)
      setSelectedFile(file)
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Bildet kunne ikke åpnes.')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function closeCropDialog() {
    setSelectedFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleProcessedImage(image: File) {
    const version = await uploadProfileImage({ familyId, memberId }, image)
    onUploaded(version)
    setMessage('Bildet er oppdatert.')
    closeCropDialog()
  }

  return (
    <div className="profile-image-upload">
      <input
        ref={inputRef}
        id={inputId}
        className="profile-image-upload__input"
        type="file"
        accept={PROFILE_IMAGE_ACCEPT}
        disabled={selectedFile !== null}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <label className="profile-image-upload__action" htmlFor={inputId} aria-disabled={selectedFile !== null}>
        {label}
      </label>
      {message && <p className="profile-image-upload__success" role="status">{message}</p>}
      {error && <p className="profile-image-upload__error" role="alert">{error}</p>}
      {selectedFile && (
        <ProfileImageCropDialog
          file={selectedFile}
          onCancel={closeCropDialog}
          onApply={handleProcessedImage}
        />
      )}
    </div>
  )
}
