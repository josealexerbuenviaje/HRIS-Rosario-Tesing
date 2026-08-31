import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";
import Login from "./pages/Loginpage";

import Dashboard        from "./pages/Dashboard";
import Employees        from "./pages/Employees";
import EmpContractual   from "./pages/Emp_contractual";
import JOContractual    from "./pages/jo_contractual";
import OJTContractual   from "./pages/ojt_contractual";
import Attendance       from "./pages/Attendance";
import Leavepage        from "./pages/Leave_page";
import Plantilla        from "./pages/Plantillapage";
import RecruitmentPage  from "./pages/Recruitmentpage";
import PerformancePage  from "./pages/Performancepage";
import TrainingPage  from "./pages/Trainingpage";
import ReportsPage      from "./pages/Reportspage";

import { isLoggedIn, initAuth } from "./auth";
import { ToastProvider } from "./components/ToastContext";
import { ToastContainer } from "./components/ToastContainer";

// Resume token auto-refresh if user is already logged in
initAuth();

function App() {
  return (
    <ToastProvider>
      <Router>
        <Routes>

          {/* Default — redirect based on JWT validity */}
          <Route
            path="/"
            element={isLoggedIn() ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}
          />

          {/* Login — redirect to dashboard if already logged in */}
          <Route
            path="/login"
            element={isLoggedIn() ? <Navigate to="/dashboard" replace /> : <Login />}
          />

          {/* Protected routes — all wrapped in ProtectedRoute + DashboardLayout */}
          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route path="/dashboard"                    element={<Dashboard />} />
            <Route path="/Employees"                    element={<Employees />} />
            <Route path="/employees/Emp_contractual"    element={<EmpContractual />} />
            <Route path="/employees/jo_contractual"     element={<JOContractual />} />
            <Route path="/employees/ojt_contractual"    element={<OJTContractual />} />
            <Route path="/Attendance"                   element={<Attendance />} />
            <Route path="/Leave_page"                   element={<Leavepage />} />
            <Route path="/Plantilla"                    element={<Plantilla />} />
            <Route path="/Recruitment"                  element={<RecruitmentPage />} />
            <Route path="/Performance"                  element={<PerformancePage />} />
            <Route path="/Training"                  element={<TrainingPage />} />
            <Route path="/Reports"                      element={<ReportsPage />} />
          </Route>

          {/* Catch-all — redirect unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </Router>
      <ToastContainer />
    </ToastProvider>
  );
}

export default App;