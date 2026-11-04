import type {} from '@netlify/functions'
import { createHash } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import webpush from 'web-push'
import { defaultNotificationPreferences } from '../../shared/pushNotifications.ts'
import { getAuthenticatedFamilyMember, jsonResponse } from './_shared/session.mts'

type Device = { familyId: string; subscription: webpush.PushSubscription }

export function validSubscription(value: unknown): value is webpush.PushSubscription {
  if (!value || typeof value !== 'object') return false
  const subscription = value as webpush.PushSubscription
  try {
    const url = new URL(subscription.endpoint)
    // Only send to browser push services; never allow arbitrary server-side requests.
    const allowed = url.hostname === 'fcm.googleapis.com' || url.hostname === 'android.googleapis.com'
      || url.hostname === 'updates.push.services.mozilla.com'
      || url.hostname.endsWith('.notify.windows.com') || url.hostname === 'web.push.apple.com'
      || url.hostname.endsWith('.push.apple.com')
    return allowed && url.protocol === 'https:' && !url.port && !url.username && !url.password
      && subscription.endpoint.length < 4096
      && /^[A-Za-z0-9_-]{87}=?$/.test(subscription.keys?.p256dh)
      && /^[A-Za-z0-9_-]{22}={0,2}$/.test(subscription.keys?.auth)
  } catch { return false }
}

export default async function pushNotifications(request: Request) {
  if (!['GET', 'POST'].includes(request.method)) return jsonResponse({ message: 'Metoden er ikke tillatt.' }, { status: 405 })
  try {
    const family = getAuthenticatedFamilyMember(request)
    if (!family) return jsonResponse({ message: 'Logg inn for å administrere varsler.' }, { status: 401 })
    if (request.method === 'POST' && request.headers.get('origin') !== new URL(request.url).origin) {
      return jsonResponse({ message: 'Ugyldig forespørsel.' }, { status: 403 })
    }
    const store = getStore({ name: 'push-notifications', consistency: 'strong' })
    const preferenceKey = `preferences/${family.id}`
    if (request.method === 'GET') {
      return jsonResponse({
        publicKey: Netlify.env.get('VAPID_PUBLIC_KEY') ?? '',
        preferences: await store.get(preferenceKey, { type: 'json' }) ?? defaultNotificationPreferences,
      })
    }
    const raw = await request.text()
    if (raw.length > 10000) return jsonResponse({ message: 'Forespørselen er for stor.' }, { status: 413 })
    let body
    try { body = JSON.parse(raw) } catch { return jsonResponse({ message: 'Ugyldig forespørsel.' }, { status: 400 }) }
    if (body?.action === 'preferences') {
      const preferences = body.preferences
      if (!preferences || Object.keys(defaultNotificationPreferences).some((key) => typeof preferences[key] !== 'boolean')) {
        return jsonResponse({ message: 'Ugyldige varselinnstillinger.' }, { status: 400 })
      }
      await store.setJSON(preferenceKey, Object.fromEntries(Object.keys(defaultNotificationPreferences).map((key) => [key, preferences[key]])))
      return jsonResponse({ ok: true })
    }
    if (!['enable', 'disable', 'status', 'test'].includes(body?.action) || !validSubscription(body.subscription)) {
      return jsonResponse({ message: 'Ugyldig varselabonnement.' }, { status: 400 })
    }
    const subscription = body.subscription as webpush.PushSubscription
    const key = `devices/${createHash('sha256').update(subscription.endpoint).digest('hex')}`
    const device = await store.get(key, { type: 'json' }) as Device | null
    const owned = device?.familyId === family.id
    if (body.action === 'status') return jsonResponse({ enabled: owned })
    if (device && !owned) return jsonResponse({ message: 'Denne enheten er tilknyttet en annen familie. Slå av varsler i nettleserinnstillingene og prøv igjen.' }, { status: 409 })
    if (body.action === 'enable') {
      await store.setJSON(key, { familyId: family.id, subscription })
      return jsonResponse({ ok: true })
    }
    if (body.action === 'disable') {
      if (owned) await store.delete(key)
      return jsonResponse({ ok: true })
    }
    if (!owned) return jsonResponse({ message: 'Aktiver varsler på denne enheten først.' }, { status: 404 })
    const publicKey = Netlify.env.get('VAPID_PUBLIC_KEY')
    const privateKey = Netlify.env.get('VAPID_PRIVATE_KEY')
    const subject = Netlify.env.get('VAPID_SUBJECT')
    if (!publicKey || !privateKey || !subject) return jsonResponse({ message: 'Varseltjenesten er ikke konfigurert.' }, { status: 503 })
    try {
      await webpush.sendNotification(device.subscription, JSON.stringify({
        title: 'Hytteappen', body: 'Dette er et testvarsel. Varsler fungerer på denne enheten.', url: '/innstillinger/varsler',
      }), { vapidDetails: { subject, publicKey, privateKey }, TTL: 60, timeout: 10000 })
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await store.delete(key)
        return jsonResponse({ message: 'Abonnementet er utløpt. Aktiver varsler på nytt.', expired: true }, { status: 410 })
      }
      throw error
    }
    return jsonResponse({ ok: true })
  } catch {
    return jsonResponse({ message: 'Kunne ikke behandle varsler. Prøv igjen.' }, { status: 500 })
  }
}
