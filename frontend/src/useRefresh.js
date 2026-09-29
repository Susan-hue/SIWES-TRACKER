import { useEffect, useRef } from 'react'

/**
 * Calls `load` on mount and again whenever the app comes back into view
 * (switching back to the installed PWA, or to this browser tab), so a phone
 * never keeps showing data from hours ago.
 */
export default function useRefresh(load, deps = []) {
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    loadRef.current()
    let last = Date.now()
    const onVisible = () => {
      // Ignore rapid focus flips (e.g. closing a select menu).
      if (document.visibilityState === 'visible' && Date.now() - last > 2000) {
        last = Date.now()
        loadRef.current()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
