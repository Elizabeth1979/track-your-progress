import { useT } from '@/i18n'
import { LegalPage } from './LegalPage'
import { TERMS_EN, TERMS_HE } from './legal-content'

export function TermsPage() {
  const t = useT()
  return <LegalPage title={t.legal.termsTitle} he={TERMS_HE} en={TERMS_EN} />
}
