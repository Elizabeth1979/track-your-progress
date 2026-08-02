import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import { queryClient, persistOptions } from './app/queryClient'
import { LocaleProvider } from './i18n'
import { ThemeProvider } from './app/ThemeProvider'
import { AuthProvider } from './app/AuthProvider'
import { ModeProvider } from './app/ModeProvider'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <LocaleProvider>
        <ThemeProvider>
          <AuthProvider>
            <ModeProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </ModeProvider>
          </AuthProvider>
        </ThemeProvider>
      </LocaleProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
)
