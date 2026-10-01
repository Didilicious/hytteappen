import { useEffect, useId, useRef, useState } from 'react'
import type { AttendancePerson, FamilyEventAttendance as Attendance } from '../../shared/familyEventRsvps'

const attendanceLabels: Record<keyof Attendance, string> = {
  attending: 'Kommer',
  notAttending: 'Kommer ikke',
  unanswered: 'Ikke svart',
}

function AttendanceList({ people }: { people: AttendancePerson[] }) {
  return people.length ? <ul className="family-event-attendance__names">
    {people.map((person) => <li key={person.id}>{person.displayName}</li>)}
  </ul> : <p>Ingen personer.</p>
}

function AttendanceDialog({ label, people, onClose }: { label: string; people: AttendancePerson[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  return <dialog ref={dialogRef} className="family-event-attendance__dialog" aria-labelledby={titleId} onClose={onClose} onClick={(event) => {
    if (event.target === event.currentTarget) dialogRef.current?.close()
  }}>
    <div className="family-event-attendance__dialog-content">
      <h2 id={titleId}>{label} · {people.length}</h2>
      <AttendanceList people={people} />
      <button className="secondary-button" type="button" autoFocus onClick={() => dialogRef.current?.close()}>Lukk</button>
    </div>
  </dialog>
}

export default function FamilyEventAttendance({ attendance }: { attendance: Attendance | null }) {
  const [openGroup, setOpenGroup] = useState<keyof Attendance | null>(null)

  if (!attendance) return <p className="error-message" role="alert">Kunne ikke hente deltakerlisten.</p>

  return <section className="family-event-attendance" aria-label="Deltakelse">
    <div className="family-event-attendance__summaries">
      {(Object.keys(attendanceLabels) as (keyof Attendance)[]).map((group) => <button
        className="secondary-button" type="button" key={group} aria-haspopup="dialog" aria-expanded={openGroup === group}
        onClick={() => setOpenGroup(group)}
      >{attendanceLabels[group]} · {attendance[group].length}</button>)}
    </div>
    {openGroup && <AttendanceDialog label={attendanceLabels[openGroup]} people={attendance[openGroup]} onClose={() => setOpenGroup(null)} />}
  </section>
}
