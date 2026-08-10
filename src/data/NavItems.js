import { FaUsers } from "react-icons/fa";
import {
  LuLayoutDashboard,
  LuUsers,
  LuBriefcase,
  LuClock,
  LuCalendarCheck,
  LuWallet,
  LuUserPlus,
  LuTrendingUp,
  LuGraduationCap,
  LuFileText,
  LuSettings,
  LuLogOut 
} from "react-icons/lu";

const navItems = [
  {
    id: 1,
    label: "Dashboard",
    icon: LuLayoutDashboard,
    path: "/dashboard",
  },
  {
    id: 2,
    label: "Employees",
    icon: LuUsers,
    children: [
      {
        id: "2-1",
        label: "Full-time",
        icon: FaUsers,
        path: "/employees",
      },
      {
        id: "2-2",
        label: "Contractual",
        icon: FaUsers,
        path: "/employees/Emp_contractual",
      },
      {
        id: "2-3",
        label: "Job-order",
        icon: FaUsers,
        path: "/employees/jo_contractual",
      },
      {
        id: "2-4",
        label: "OJT",
        icon: FaUsers,
        path: "/employees/ojt_contractual",
      },
    ],
  },  
  {
    id: 3,
    label: "Attendance",
    icon: LuClock,
    path: "/Attendance",
  },
  {
    id: 4,
    label: "Leave",
    icon: LuCalendarCheck,
    path: "/Leave_page",
  },
  {
    id: 5,
    label: "Plantilla",
    icon: LuBriefcase,
    path: "/Plantilla",
  },
  {
    id: 6,
    label: "Recruitment",
    icon: LuUserPlus ,
    path: "/Recruitment",
  },
  {
    id: 7,
    label: "Performance",
    icon: LuTrendingUp,
    path: "/Performance",
  },
  {
    id: 8,
    label: "Training",
    icon: LuGraduationCap ,
    path: "/Training",
  },
  {
    id: 9,
    label: "Reports",
    icon: LuFileText,
    path: "/Reports",
  },
  {
    id: 10,
    label: "Logout",
    icon: LuLogOut,
    path: "/login",
  },

];

export default navItems;
