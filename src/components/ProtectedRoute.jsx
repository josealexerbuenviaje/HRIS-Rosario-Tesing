import { Navigate, useLocation } from "react-router-dom";
import { isLoggedIn, clearToken } from "../auth";

const ProtectedRoute = ({ children }) => {
  const location = useLocation();

  if (!isLoggedIn()) {

    clearToken();
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
