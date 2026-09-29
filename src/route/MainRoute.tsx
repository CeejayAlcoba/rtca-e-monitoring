import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useAuth } from "../context/UserContext";
import MainLayout from "../layouts/MainLayout";
import HomePage from "../pages/home/HomePage";
import MeDashboard from "../pages/me/MeDashboard";
import StatisticPage from "../pages/statistic/StatisticPage";
import PersonnelIndex from "../pages/personel/PersonelIndex";
import RankIndex from "../pages/rank/RankIndex";
import ActivityTypeIndex from "../pages/activity-type/ActivityTypeIndex";
import RequestLeave from "../pages/personnel-activity/RequestLeave";
import ApprovalLeave from "../pages/personnel-activity/ApprovalLeave";
import DepartmentIndex from "../pages/department/DepartmentIndex";
import EtePage from "../pages/ete/EtePage";
import ActivityHistoryPage from "../pages/leave-history/ActivityHistoryPage";
import UserIndex from "../pages/user/UserIndex";
import RoleIndex from "../pages/role/RoleIndex";
import AuthPage from "../pages/auth/authPage";
import ChangeDefaultPassword from "../pages/auth/ChangeDefaultPassword";
import EteExplanationIndex from "../pages/ete-email-layout/EteExplanationIndex";
import EteNotifyIndex from "../pages/ete-email-layout/EteNotifyIndex";
import SidebarIndex from "../pages/role-sidebar/RoleSidebarIndex";
import ApproverPage from "../pages/approver/ApproverIndex";
import ActivityAppealForm from "../pages/appeal/ActivityAppealForm";
import SchoolingIndex from "../pages/schooling/SchoolingIndex";
import RestrictedIndex from "../pages/restricted/RestrictedIndex";
import MyDepartmentIndex from "../pages/my-department/MyDepartmentIndex";
import LongevityPayIndex from "../pages/longevity-pay/LongevityPayIndex";
import PersonnelLongevityPayIndex from "../pages/personnel-longevity-pay/PersonnelLongevityPayIndex";
import ManualActivityIndex from "../pages/manual-activity/ManualActivityndex";
import TestPage from "../pages/test/TestPage";

// Import your pages... (omitted for brevity, keep your existing imports)

export default function MainRoute() {
  const { user } = useAuth();



  // 1. Extract allowed paths from the user's role
  // We include "/" and "/dashboard" as common defaults if not explicitly in DB
  const allowedPaths =
    user?.role?.sidebarRoleMappings?.map((m) =>
      m.sidebar?.path?.toLowerCase(),
    ) || [];

  console.log(allowedPaths)
  // 2. Helper to check if a route is permitted
  const isAllowed = (path: string) => {
    if (!user) return false;
    if (path === "/dashboard") return true;
    return allowedPaths.includes(path.toLowerCase()) || user.role?.isSuperAdmin;
  };

  return (
    <>
     
      <Router>
        <Routes>
          {/* --- Protected Routes (Inside MainLayout) --- */}
          <Route
            path="/"
            element={user ? <MainLayout /> : <Navigate to="/auth" replace />}
          >
            {/* Default/Common Routes */}
            <Route path="/" element={<MeDashboard />} />

            {/* Role-Based Dynamic Routes */}
            {isAllowed("/home") && <Route path="/home" element={<HomePage />} />}
            {isAllowed("/approver") && (
              <Route path="/approver" element={<ApproverPage />} />
            )}
            {isAllowed("/statistics") && (
              <Route path="/statistics" element={<StatisticPage />} />
            )}
            {isAllowed("/personnel") && (
              <Route path="/personnel" element={<PersonnelIndex />} />
            )}
            {isAllowed("/rank") && <Route path="/rank" element={<RankIndex />} />}
            {isAllowed("/activity-type") && (
              <Route path="/activity-type" element={<ActivityTypeIndex />} />
            )}
            {isAllowed("/activity-request") && (
              <Route path="/activity-request" element={<RequestLeave />} />
            )}
            {isAllowed("/activity-approval") && (
              <Route path="/activity-approval" element={<ApprovalLeave />} />
            )}
            {isAllowed("/department") && (
              <Route path="/department" element={<DepartmentIndex />} />
            )}
            {isAllowed("/ete") && <Route path="/ete" element={<EtePage />} />}
            {isAllowed("/activity-history") && (
              <Route path="/activity-history" element={<ActivityHistoryPage />} />
            )}
            {isAllowed("/activity-types") && (
              <Route path="/activity-types" element={<ActivityTypeIndex />} />
            )}
            {isAllowed("/user") && <Route path="/user" element={<UserIndex />} />}
            {isAllowed("/role") && <Route path="/role" element={<RoleIndex />} />}
            {isAllowed("/sidebar") && (
              <Route path="/sidebar" element={<SidebarIndex />} />
            )}
            {isAllowed("/schooling") && (
              <Route path="/schooling" element={<SchoolingIndex />} />
            )}
            {isAllowed("/restricted") && (
              <Route path="/restricted" element={<RestrictedIndex />} />
            )}
            {isAllowed("/my-department") && (
              <Route path="/my-department" element={<MyDepartmentIndex />} />
            )}
            {isAllowed("/longevity-pay") && (
              <Route path="/longevity-pay" element={<LongevityPayIndex />} />
            )}
            {isAllowed("/personnel-longevity-pay") && (
              <Route
                path="/personnel-longevity-pay"
                element={<PersonnelLongevityPayIndex />}
              />
            )}
            {isAllowed("/manual-activity") && (
              <Route path="/manual-activity" element={<ManualActivityIndex />} />
            )}

            {/* Catch-all for unauthorized paths inside the layout */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>

          {/* --- Public / Token-Based Routes (Outside MainLayout) --- */}
          <Route
            path="/auth"
            element={!user ? <AuthPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/change-password/:token"
            element={<ChangeDefaultPassword />}
          />
          <Route
            path="/ete-explanation/:token"
            element={<EteExplanationIndex />}
          />
          <Route path="/ete-notify/:token" element={<EteNotifyIndex />} />
          <Route
            path="/activities/appeal/:token"
            element={<ActivityAppealForm />}
          />
          <Route path="/test" element={<TestPage />} />

          {/* Global Redirect */}
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </Router>
    </>
  );
}
