import Sidebar from "../components/Sidebar/Sidebar";
import { Outlet } from "react-router-dom";

function DashboardLayout() {
  return (
    <div 
    style={{ padding: "10px 40px 30px 110px", height: "100%"}}>
      <Sidebar />
      <Outlet />
    </div>
  );
}

export default DashboardLayout;