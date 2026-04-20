import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TeacherLeaveDashboard from './pages/TeacherLeaveDashboard';
import ApplyLeave from './pages/ApplyLeave';
import SubstituteRequests from './pages/SubstituteRequests';
import HODDashboard from './pages/HODDashboard';
import PrincipalDashboard from './pages/PrincipalDashboard';
import Login from './pages/Login';
import { Toaster } from 'react-hot-toast';

const storedUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null;
const storedToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
const user = storedUser || { role: 'teacher' };

function PrivateRoute({ children, roles }) {
  if (!storedToken) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />

      <Routes>

        <Route path="/login" element={<Login />} />

        {/* Home Route (role-based dashboard) */}
        <Route
          path="/"
          element={storedToken ? (
            user.role === 'teacher' ? <TeacherLeaveDashboard /> :
            user.role === 'hod' ? <HODDashboard /> :
            <PrincipalDashboard />
          ) : <Navigate to="/login" replace />}
        />

        {/* ✅ Leave Dashboard */}
        <Route
          path="/leave"
          element={
            <PrivateRoute>
              <TeacherLeaveDashboard />
            </PrivateRoute>
          }
        />

        {/* Teacher Routes */}
        <Route
          path="/apply-leave"
          element={
            <PrivateRoute roles={['teacher']}>
              <ApplyLeave />
            </PrivateRoute>
          }
        />

        <Route
          path="/substitute-requests"
          element={
            <PrivateRoute roles={['teacher']}>
              <SubstituteRequests />
            </PrivateRoute>
          }
        />

        {/* HOD */}
        <Route
          path="/hod"
          element={
            <PrivateRoute roles={['hod']}>
              <HODDashboard />
            </PrivateRoute>
          }
        />

        {/* Principal */}
        <Route
          path="/principal"
          element={
            <PrivateRoute roles={['principal']}>
              <PrincipalDashboard />
            </PrivateRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}