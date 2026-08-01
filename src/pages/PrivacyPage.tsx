import { useT } from '@/i18n'
import { LegalPage } from './LegalPage'
import { PRIVACY_EN, PRIVACY_HE } from './legal-content'

export function PrivacyPage() {
  const t = useT()
  return <LegalPage title={t.legal.privacyTitle} he={PRIVACY_HE} en={PRIVACY_EN} />
}
