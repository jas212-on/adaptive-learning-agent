import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicLayout } from './layouts/PublicLayout'
import { DashboardLayout } from './layouts/DashboardLayout'
import { ProtectedRoute } from './components/ProtectedRoute'

import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Detection from './pages/Detection'
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
import Resources from './pages/dashboard/topic/Resources'
import Questions from './pages/dashboard/topic/Questions'
import Quiz from './pages/dashboard/topic/Quiz'

import RoadmapIndex from './pages/dashboard/topic/RoadmapIndex'
import RoadmapModule from './pages/dashboard/topic/RoadmapModule'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
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
        <Route path="topics/:topicId" element={<TopicDetails />}>
          <Route index element={<Navigate to="detected" replace />} />
          <Route path="detected" element={<DetectedInfo />} />
          <Route path="roadmap" element={<RoadmapIndex />} />
          <Route path="roadmap/:moduleId" element={<RoadmapModule />}>
            <Route index element={<Navigate to="explainer" replace />} />
            <Route path="explainer" element={<Explainer />} />
            <Route path="resources" element={<Resources />} />
            <Route path="questions" element={<Questions />} />
            <Route path="quiz" element={<Quiz />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
