import {
  WifiOff,
} from 'lucide-react'
import {
  useEffect,
  useState,
} from 'react'

export function ConnectivityBanner() {
  const [online, setOnline] =
    useState(() => navigator.onLine)

  useEffect(() => {
    const goOnline = () =>
      setOnline(true)
    const goOffline = () =>
      setOnline(false)

    window.addEventListener(
      'online',
      goOnline,
    )
    window.addEventListener(
      'offline',
      goOffline,
    )

    return () => {
      window.removeEventListener(
        'online',
        goOnline,
      )
      window.removeEventListener(
        'offline',
        goOffline,
      )
    }
  }, [])

  if (online) {
    return null
  }

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-[11px] font-semibold text-amber-800"
    >
      <WifiOff size={13} />
      Sem conexão. Consultas e operações que dependem do servidor ficarão indisponíveis até a rede retornar.
    </div>
  )
}
