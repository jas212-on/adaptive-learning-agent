import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicLayout } from './layouts/PublicLayout'
import { DashboardLayout } from './layouts/DashboardLayout'
import { ProtectedRoute } from './components/ProtectedRoute'

import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import NotFound from './pages/NotFound'

import DashboardHome from './pages/dashboard/DashboardHome'
import TopicsIndex from './pages/dashboard/TopicsIndex'
import TopicDetails from './pages/dashboard/TopicDetails'
import Analytics from './pages/dashboard/Analytics'
import Suggestions from './pages/dashboard/Suggestions'
import Timetable from './pages/dashboard/Timetable'
import DependencyGraph from './pages/dashboard/DependencyGraph'

import DetectedInfo from './pages/dashboard/topic/DetectedInfo'
import Explainer from './pages/dashboard/topic/Explainer'
import Roadmap from './pages/dashboard/topic/Roadmap'
import Resources from './pages/dashboard/topic/Resources'
import Questions from './pages/dashboard/topic/Questions'
import Quiz from './pages/dashboard/topic/Quiz'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Route>

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
        <Route path="topics/:topicId" element={<TopicDetails />}>
          <Route index element={<Navigate to="detected" replace />} />
          <Route path="detected" element={<DetectedInfo />} />
          <Route path="explainer" element={<Explainer />} />
          <Route path="roadmap" element={<Roadmap />} />
          <Route path="resources" element={<Resources />} />
          <Route path="questions" element={<Questions />} />
          <Route path="quiz" element={<Quiz />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
