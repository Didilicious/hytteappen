import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { formatBirthday } from '../birthdays'
import AppFrame from '../components/AppFrame'
import MemberContactEditor from '../components/MemberContactEditor'
import ProfileImage from '../components/ProfileImage'
import ProfileImageUpload from '../components/ProfileImageUpload'
import { getFamily, type FamilyMember } from '../families'
import {
  readFamilyProfiles,
  updateMemberProfile,
  type MemberProfile,
  type MemberProfileInput,
} from '../memberProfiles'

function emptyInput(): MemberProfileInput {
  return { phones: [], emails: [], addresses: [] }
}

function cloneInput(profile?: MemberProfile): MemberProfileInput {
  if (!profile) return emptyInput()
  return {
    phones: profile.phones.map((entry) => ({ ...entry })),
    emails: profile.emails.map((entry) => ({ ...entry })),
    addresses: profile.addresses.map((entry) => ({ ...entry })),
  }
}

function ContactSection({ title, entries, kind }: {
  title: string
  entries: MemberProfile['phones']
  kind: 'phone' | 'email' | 'address'
}) {
  if (entries.length === 0) return null

  return (
    <section className="member-contact-section">
      <h4>{title}</h4>
      <dl>
        {entries.map((entry) => (
          <div className="member-contact-item" key={entry.id}>
            {entry.label && <dt>{entry.label}</dt>}
            <dd className={kind === 'address' ? 'member-contact-item__address' : undefined}>
              {kind === 'phone' && <a href={`tel:${entry.value}`}>{entry.value}</a>}
              {kind === 'email' && <a href={`mailto:${entry.value}`}>{entry.value}</a>}
              {kind === 'address' && entry.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function MemberContacts({ profile }: { profile?: MemberProfile }) {
  if (!profile || (profile.phones.length === 0 && profile.emails.length === 0 && profile.addresses.length === 0)) {
    return null
  }

  return (
    <div className="member-contact-details">
      <ContactSection title="Telefon" entries={profile.phones} kind="phone" />
      <ContactSection title="E-post" entries={profile.emails} kind="email" />
      <ContactSection title="Adresse" entries={profile.addresses} kind="address" />
    </div>
  )
}

export default function FamilyProfilePage() {
  const { familyId } = useParams()
  const { currentUser } = useAuth()
  const family = getFamily(familyId)
  const [profiles, setProfiles] = useState<MemberProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [draft, setDraft] = useState<MemberProfileInput>(emptyInput)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedMemberId, setSavedMemberId] = useState<string | null>(null)
  const [familyImageVersion, setFamilyImageVersion] = useState<string>()
  const [memberImageVersions, setMemberImageVersions] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!family) return

    const controller = new AbortController()
    setProfiles([])
    setLoading(true)
    setLoadError(null)
    setEditingMemberId(null)
    setSavedMemberId(null)
    setFamilyImageVersion(undefined)
    setMemberImageVersions({})

    void readFamilyProfiles(family.accountId, controller.signal)
      .then((loadedProfiles) => setProfiles(loadedProfiles))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : 'Kunne ikke hente kontaktinformasjonen.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [family])

  const profilesByMemberId = useMemo(
    () => new Map(profiles.map((profile) => [profile.memberId, profile])),
    [profiles],
  )

  if (!family) {
    return (
      <AppFrame showAccount>
        <Link className="back-button" to="/familieoversikt">
          <span aria-hidden="true">←</span>
          Tilbake til familieoversikten
        </Link>

        <section className="family-not-found page-enter" aria-labelledby="family-not-found-title">
          <p className="eyebrow">Familieoversikt</p>
          <h1 id="family-not-found-title">Familien ble ikke funnet</h1>
          <p>Familien finnes ikke i oversikten. Du kan gå tilbake og velge en annen familie.</p>
          <Link className="secondary-button" to="/familieoversikt">Se alle familier</Link>
        </section>
      </AppFrame>
    )
  }

  const selectedFamily = family
  const canEdit = currentUser?.id === family.accountId

  function startEditing(member: FamilyMember) {
    setEditingMemberId(member.id)
    setDraft(cloneInput(profilesByMemberId.get(member.id)))
    setSaveError(null)
    setSavedMemberId(null)
  }

  async function saveChanges(memberId: string) {
    setSaving(true)
    setSaveError(null)

    try {
      const profile = await updateMemberProfile(selectedFamily.accountId, memberId, draft)
      setProfiles((current) => [...current.filter((candidate) => candidate.memberId !== memberId), profile])
      setEditingMemberId(null)
      setSavedMemberId(memberId)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Kunne ikke lagre endringene. Prøv igjen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppFrame showAccount>
      <Link className="back-button" to="/familieoversikt">
        <span aria-hidden="true">←</span>
        Tilbake til familieoversikten
      </Link>

      <header className="family-profile-heading page-enter">
        <ProfileImage
          familyId={family.accountId}
          variant="family"
          alt={`Familiebilde for ${family.displayName}`}
          version={familyImageVersion}
        />
        <div className="family-profile-heading__content">
          <p className="eyebrow">Familieprofil</p>
          <h1>{family.displayName}</h1>
          {canEdit && (
            <ProfileImageUpload
              familyId={family.accountId}
              label="Endre familiebilde"
              onUploaded={setFamilyImageVersion}
            />
          )}
        </div>
      </header>

      <section className="family-member-section page-enter page-enter--delay" aria-labelledby="family-members-title">
        <div className="family-member-section__heading">
          <h2 id="family-members-title">Familiemedlemmer</h2>
          {loading && <p className="family-profile-status" role="status">Laster kontaktinformasjon …</p>}
        </div>

        {loadError && (
          <div className="family-profile-error" role="alert">
            <strong>Kontaktinformasjonen kunne ikke lastes.</strong>
            <p>{loadError}</p>
          </div>
        )}

        <div className="family-member-grid">
          {family.members.map((member) => {
            const profile = profilesByMemberId.get(member.id)
            const isEditing = editingMemberId === member.id

            return (
              <article className={`family-member-card${isEditing ? ' family-member-card--editing' : ''}`} key={member.id}>
                <div className="family-member-card__header">
                  <ProfileImage
                    familyId={family.accountId}
                    memberId={member.id}
                    variant="member"
                    alt={`Profilbilde av ${member.displayName}`}
                    version={memberImageVersions[member.id]}
                  />
                  <div>
                    <h3>{member.displayName}</h3>
                    {canEdit && (
                      <div className="family-member-card__actions">
                        <ProfileImageUpload
                          familyId={family.accountId}
                          memberId={member.id}
                          label="Endre bilde"
                          onUploaded={(version) => setMemberImageVersions((current) => ({
                            ...current,
                            [member.id]: version,
                          }))}
                        />
                        {!isEditing && (
                          <button
                            className="family-member-card__edit"
                            type="button"
                            onClick={() => startEditing(member)}
                            disabled={loading || Boolean(loadError)}
                          >
                            Rediger kontaktinfo
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <dl className="family-member-birthday">
                  <dt>Bursdag</dt>
                  <dd>{formatBirthday(member.birthday)}</dd>
                </dl>

                {savedMemberId === member.id && (
                  <p className="member-profile-success" role="status">Endringene er lagret.</p>
                )}

                {isEditing ? (
                  <MemberContactEditor
                    memberName={member.displayName}
                    value={draft}
                    saving={saving}
                    error={saveError}
                    onChange={setDraft}
                    onSave={() => void saveChanges(member.id)}
                    onCancel={() => {
                      setEditingMemberId(null)
                      setSaveError(null)
                    }}
                  />
                ) : (
                  <MemberContacts profile={profile} />
                )}
              </article>
            )
          })}
        </div>
      </section>
    </AppFrame>
  )
}
