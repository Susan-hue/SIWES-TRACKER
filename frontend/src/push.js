import { get, post } from './api'

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  const url = import.meta.env.DEV ? '/dev-sw.js?dev-sw' : '/sw.js'
  navigator.serviceWorker
    .register(url, { type: import.meta.env.DEV ? 'module' : 'classic' })
    .catch((err) => console.warn('Service worker registration failed', err))
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** Ask for permission (must run from a tap) and store the subscription on the server. */
export async function enablePush() {
  if (!pushSupported()) throw new Error('This browser does not support push. On iPhone, add the app to your Home Screen first.')
  const config = await get('config/')
  if (!config.vapid_public_key) throw new Error('Push is not configured on the server yet (VAPID keys missing).')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications were not allowed.')

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.vapid_public_key),
    })
  }
  await post('push/subscription/', sub.toJSON())
  return sub
}

export async function currentPushState() {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'prompt'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg && (await reg.pushManager.getSubscription())
  return sub ? 'subscribed' : 'prompt'
}
