import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './app/AuthProvider'
import { Spinner } from './components/ui'
import { useT } from './i18n'

import { LoginPage } from './features/auth/LoginPage'
import { SignupPage } from './features/auth/SignupPage'
import { VerifyEmailPage } from './features/auth/VerifyEmailPage'
import { OnboardingPage } from './features/family/OnboardingPage'
import { JoinPage } from './features/invites/JoinPage'

import { ChildPickerPage } from './features/child/ChildPickerPage'
import { ChildLayout } from './features/child/ChildLayout'
import { MyDayPage } from './features/child/MyDayPage'
import { TaskDetailPage } from './features/child/TaskDetailPage'
import { RoutinePlayPage } from './features/child/RoutinePlayPage'
import { ChildRewardsPage } from './features/child/ChildRewardsPage'
import { ChildJournalPage } from './features/child/ChildJournalPage'

import { ParentLayout } from './features/parent/ParentLayout'
import { DashboardPage } from './features/parent/DashboardPage'
import { ChildrenPage } from './features/parent/ChildrenPage'
import { TasksPage } from './features/parent/TasksPage'
import { TaskFormPage } from './features/parent/TaskFormPage'
import { RoutinesPage } from './features/parent/RoutinesPage'
import { RewardsPage } from './features/parent/RewardsPage'
import { ParentJournalPage } from './features/parent/ParentJournalPage'
import { ProgressPage } from './features/parent/ProgressPage'
import { InvitesPage } from './features/parent/InvitesPage'
import { SettingsPage } from './features/parent/SettingsPage'

import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { DeleteAccountRequestPage } from './pages/DeleteAccountRequestPage'
import { InstallPage } from './pages/InstallPage'
import { NotFoundPage } from './pages/NotFoundPage'

function FullScreenLoader() {
  const t = useT()
  return (
    <div className="center-screen">
      <Spinner label={t.common.loading} />
    </div>
  )
}

/** Signed in, and the account already belongs to a family. */
function RequireFamily({ children }: { children: ReactNode }) {
  const { session, loading, profile, profileLoading } = useAuth()
  const location = useLocation()

  if (loading || (session && profileLoading)) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!profile) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

function RedirectHome() {
  const { session, loading, profile, profileLoading } = useAuth()

  if (loading || (session && profileLoading)) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/onboarding" replace />
  return <Navigate to="/child" replace />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RedirectHome />} />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/join/:code" element={<JoinPage />} />

      <Route
        path="/child"
        element={
          <RequireFamily>
            <ChildPickerPage />
          </RequireFamily>
        }
      />
      <Route
        path="/child/:childId"
        element={
          <RequireFamily>
            <ChildLayout />
          </RequireFamily>
        }
      >
        <Route index element={<MyDayPage />} />
        <Route path="rewards" element={<ChildRewardsPage />} />
        <Route path="journal" element={<ChildJournalPage />} />
      </Route>
      <Route
        path="/child/:childId/task/:taskId"
        element={
          <RequireFamily>
            <TaskDetailPage />
          </RequireFamily>
        }
      />
      <Route
        path="/child/:childId/routine/:routineId"
        element={
          <RequireFamily>
            <RoutinePlayPage />
          </RequireFamily>
        }
      />

      <Route
        path="/parent"
        element={
          <RequireFamily>
            <ParentLayout />
          </RequireFamily>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="children" element={<ChildrenPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="tasks/new" element={<TaskFormPage />} />
        <Route path="tasks/:taskId" element={<TaskFormPage />} />
        <Route path="routines" element={<RoutinesPage />} />
        <Route path="rewards" element={<RewardsPage />} />
        <Route path="journal" element={<ParentJournalPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="invites" element={<InvitesPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/delete-account" element={<DeleteAccountRequestPage />} />
      <Route path="/install" element={<InstallPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
