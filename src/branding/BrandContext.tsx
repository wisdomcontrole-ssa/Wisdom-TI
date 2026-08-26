import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_BRANDING,
  getPublicBranding,
  type PublicBranding,
} from './branding-service'

interface BrandingContextValue {
  branding: PublicBranding
  loading: boolean
  refreshBranding: () => Promise<void>
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_BRANDING,
  loading: false,
  refreshBranding: async () => undefined,
})

export function BrandingProvider({
  children,
}: {
  children: ReactNode
}) {
  const [branding, setBranding] =
    useState<PublicBranding>(DEFAULT_BRANDING)
  const [loading, setLoading] = useState(true)

  const refreshBranding = useCallback(async () => {
    try {
      const next = await getPublicBranding()
      setBranding(next)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const next = await getPublicBranding()

        if (active) {
          setBranding(next)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [])

  const value = useMemo(
    () => ({
      branding,
      loading,
      refreshBranding,
    }),
    [branding, loading, refreshBranding],
  )

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  return useContext(BrandingContext)
}
