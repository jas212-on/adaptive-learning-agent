import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicLayout } from './layouts/PublicLayout'
import { DashboardLayout } from './layouts/DashboardLayout'
import { ProtectedRoute } from './components/ProtectedRoute'

import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Detection from './pages/Detection'
import NotFound from './pages/NotFound'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'

import DashboardHome from './pages/dashboard/DashboardHome'
import TopicsIndex from './pages/dashboard/TopicsIndex'
import TopicDetails from './pages/dashboard/TopicDetails'
import Analytics from './pages/dashboard/Analytics'
import Suggestions from './pages/dashboard/Suggestions'
import Timetable from './pages/dashboard/Timetable'
import DependencyGraph from './pages/dashboard/DependencyGraph'

// Learning Mode view for focused learning experience
import LearningMode from './pages/dashboard/LearningMode'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
      </Route>

      <Route
        path="/detection"
        element={
          <ProtectedRoute>
            <Detection />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="suggestions" element={<Suggestions />} />
        <Route path="timetable" element={<Timetable />} />
        <Route path="dependency-graph" element={<DependencyGraph />} />

        <Route path="topics" element={<TopicsIndex />} />
        {/* TopicDetails now handles all module/step navigation via query params */}
        <Route path="topics/:topicId" element={<TopicDetails />} />
      </Route>

      {/* Learning Mode - focused learning experience */}
      <Route
        path="/learn/:topicId"
        element={
          <ProtectedRoute>
            <LearningMode />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
