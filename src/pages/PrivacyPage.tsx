import { useT } from '@/i18n'
import { LegalPage } from './LegalPage'
import { PRIVACY_EN, PRIVACY_HE } from './legal-content'

export function PrivacyPage() {
  const t = useT()
  return <LegalPage title={t.legal.privacyTitle} he={PRIVACY_HE} en={PRIVACY_EN} />
}

// Default export so the router can code-split this page into its own chunk.
export default PrivacyPage
