type ProfilePlaceholderProps = {
  variant: 'family' | 'member'
}

export default function ProfilePlaceholder({ variant }: ProfilePlaceholderProps) {
  return (
    <span className={`profile-placeholder profile-placeholder--${variant}`} aria-hidden="true">
      <span className="profile-placeholder__head" />
      <span className="profile-placeholder__body" />
      {variant === 'family' && (
        <>
          <span className="profile-placeholder__head profile-placeholder__head--second" />
          <span className="profile-placeholder__body profile-placeholder__body--second" />
        </>
      )}
    </span>
  )
}
