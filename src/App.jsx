import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import InstallPwa from './components/InstallPwa';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { HomeRedirect } from './components/auth/HomeRedirect';

// Layouts & Auth Pages
import AdminLayout from './layouts/AdminLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import SchoolSetup from './pages/SchoolSetup';

// Admin Pages
import Classes from './pages/admin/Classes';
import ClassDetails from './pages/admin/ClassDetails';
import Students from './pages/admin/Students';
import Subjects from './pages/admin/Subjects';
import Teachers from './pages/admin/Teachers';
import Lessons from './pages/admin/Lessons';
import IntelligenceReports from './pages/admin/IntelligenceReports';
import SyllabusManager from './pages/admin/SyllabusManager';
import TimetableManager from './pages/admin/TimetableManager';
import SchoolDocuments from './pages/admin/SchoolDocuments';
import DataExport from './pages/admin/DataExport';
import ParentManagement from './pages/admin/ParentManagement';
import PolicyEditor from './pages/admin/PolicyEditor';
import ParentDashboard from './pages/parent/ParentDashboard';

// --- MAIN APP COMPONENT ---
function App() {
  return (
    <Router>
      <InstallPwa />
      <Routes>
        {/* PUBLIC ACCESSIBLE ROUTES */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/setup-school" element={<SchoolSetup />} />
        
        {/* DYNAMIC ROOT ROUTE (ADMIN VS TEACHER) */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <HomeRedirect />
            </ProtectedRoute>
          } 
        />

        {/* PROTECTED ADMIN MODULES (Wrapped in Sidebar) */}
        <Route path="/classes" element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout><Classes /></AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/classes/:classId" element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout><ClassDetails /></AdminLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/students" element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout><Students /></AdminLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/subjects" element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout><Subjects /></AdminLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/teachers" element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout><Teachers /></AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/lessons" element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout><Lessons /></AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/reports" element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout><IntelligenceReports /></AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/syllabus" element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout><SyllabusManager /></AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/timetables" element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout><TimetableManager /></AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/documents" element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout><SchoolDocuments /></AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/export" element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout><DataExport /></AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/admin/parents" element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout><ParentManagement /></AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/admin/policies" element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout><PolicyEditor /></AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/parent" element={
          <ProtectedRoute allowedRole="parent">
            <ParentDashboard />
          </ProtectedRoute>
        } />

        {/* CATCH-ALL REDIRECT TO LOGIN */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
