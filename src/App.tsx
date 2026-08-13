import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import BookingCalendarPage from './pages/BookingCalendarPage'
import BookingDetailsPage from './pages/BookingDetailsPage'
import BookingLandingPage from './pages/BookingLandingPage'
import EditBookingPage from './pages/EditBookingPage'
import EditBookingsPage from './pages/EditBookingsPage'
import GuidePage from './pages/GuidePage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import NewBookingPage from './pages/NewBookingPage'
import NewNoticeboardPostPage from './pages/NewNoticeboardPostPage'
import NoticeboardPage from './pages/NoticeboardPage'
import NoticeboardPostPage from './pages/NoticeboardPostPage'
import SolvedNoticeboardPostsPage from './pages/SolvedNoticeboardPostsPage'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { status } = useAuth()

  if (status === 'loading') {
    return null
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

export default function App() {
  const { status } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={status === 'authenticated' ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/guide/:guideId/:nodeId?"
        element={
          <ProtectedRoute>
            <GuidePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/noticeboard"
        element={
          <ProtectedRoute>
            <NoticeboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/noticeboard/new"
        element={
          <ProtectedRoute>
            <NewNoticeboardPostPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/noticeboard/solved"
        element={
          <ProtectedRoute>
            <SolvedNoticeboardPostsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/noticeboard/:postId"
        element={
          <ProtectedRoute>
            <NoticeboardPostPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/booking"
        element={
          <ProtectedRoute>
            <BookingLandingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/booking/calendar"
        element={
          <ProtectedRoute>
            <BookingCalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/booking/new"
        element={
          <ProtectedRoute>
            <NewBookingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/booking/edit"
        element={
          <ProtectedRoute>
            <EditBookingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/booking/edit/:bookingId"
        element={
          <ProtectedRoute>
            <EditBookingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/booking/:bookingId"
        element={
          <ProtectedRoute>
            <BookingDetailsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
