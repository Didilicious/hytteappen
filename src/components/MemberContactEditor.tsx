import type { ContactEntry, MemberProfileInput } from '../memberProfiles'

type ContactKind = 'phones' | 'emails' | 'addresses'

type MemberContactEditorProps = {
  memberName: string
  value: MemberProfileInput
  saving: boolean
  error: string | null
  onChange: (value: MemberProfileInput) => void
  onSave: () => void
  onCancel: () => void
}

const sections: Array<{
  key: ContactKind
  title: string
  addLabel: string
  valueLabel: string
  inputType: 'tel' | 'email' | 'textarea'
}> = [
  { key: 'phones', title: 'Telefonnummer', addLabel: '+ Legg til telefonnummer', valueLabel: 'Telefonnummer', inputType: 'tel' },
  { key: 'emails', title: 'E-post', addLabel: '+ Legg til e-postadresse', valueLabel: 'E-postadresse', inputType: 'email' },
  { key: 'addresses', title: 'Adresse', addLabel: '+ Legg til adresse', valueLabel: 'Adresse', inputType: 'textarea' },
]

function newEntry(): ContactEntry {
  return { id: crypto.randomUUID(), label: '', value: '' }
}

export default function MemberContactEditor({
  memberName,
  value,
  saving,
  error,
  onChange,
  onSave,
  onCancel,
}: MemberContactEditorProps) {
  function updateEntry(kind: ContactKind, entryId: string, field: 'label' | 'value', fieldValue: string) {
    onChange({
      ...value,
      [kind]: value[kind].map((entry) => entry.id === entryId ? { ...entry, [field]: fieldValue } : entry),
    })
  }

  function removeEntry(kind: ContactKind, entryId: string) {
    onChange({ ...value, [kind]: value[kind].filter((entry) => entry.id !== entryId) })
  }

  return (
    <form className="member-contact-editor" onSubmit={(event) => { event.preventDefault(); onSave() }}>
      <div className="member-contact-editor__heading">
        <p className="eyebrow">Rediger kontaktinformasjon</p>
        <h4>{memberName}</h4>
      </div>

      {sections.map((section) => (
        <fieldset className="member-contact-editor__section" key={section.key}>
          <legend>{section.title}</legend>
          <div className="member-contact-editor__entries">
            {value[section.key].map((entry, index) => (
              <div className="member-contact-editor__entry" key={entry.id}>
                <label className="field-group">
                  <span>Etikett <small>(valgfritt)</small></span>
                  <input
                    type="text"
                    value={entry.label}
                    onChange={(event) => updateEntry(section.key, entry.id, 'label', event.target.value)}
                    aria-label={`${section.title} ${index + 1}, etikett`}
                  />
                </label>
                <label className="field-group">
                  <span>{section.valueLabel}</span>
                  {section.inputType === 'textarea' ? (
                    <textarea
                      value={entry.value}
                      onChange={(event) => updateEntry(section.key, entry.id, 'value', event.target.value)}
                      aria-label={`${section.title} ${index + 1}, verdi`}
                      rows={3}
                    />
                  ) : (
                    <input
                      type={section.inputType}
                      value={entry.value}
                      onChange={(event) => updateEntry(section.key, entry.id, 'value', event.target.value)}
                      aria-label={`${section.title} ${index + 1}, verdi`}
                    />
                  )}
                </label>
                <button
                  className="member-contact-editor__remove"
                  type="button"
                  onClick={() => removeEntry(section.key, entry.id)}
                  aria-label={`Fjern ${section.title.toLocaleLowerCase('nb-NO')} ${index + 1}`}
                >
                  Fjern
                </button>
              </div>
            ))}
          </div>
          <button
            className="member-contact-editor__add"
            type="button"
            onClick={() => onChange({ ...value, [section.key]: [...value[section.key], newEntry()] })}
          >
            {section.addLabel}
          </button>
        </fieldset>
      ))}

      {error && <p className="error-message member-contact-editor__feedback" role="alert">{error}</p>}

      <div className="member-contact-editor__actions">
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? 'Lagrer …' : 'Lagre endringer'}
        </button>
        <button className="secondary-button" type="button" onClick={onCancel} disabled={saving}>Avbryt</button>
      </div>
    </form>
  )
}
