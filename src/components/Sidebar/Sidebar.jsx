import { useState, useEffect } from "react";
import { FaBars, FaChevronDown } from "react-icons/fa";
import { LuLogOut } from "react-icons/lu";
import { NavLink, useLocation } from "react-router-dom";
import navItems from "../../data/NavItems";
import { logout, getUser } from "../../auth";
import "./Sidebar.css";

export default function Sidebar() {
  const [isOpen,    setIsOpen]    = useState(false);
  const [openMenu,  setOpenMenu]  = useState(null);
  const location = useLocation();

  // Get logged-in user info from localStorage
  const user = getUser();

  const toggleSidebar = () => setIsOpen(!isOpen);
  const toggleSubMenu = (id) => setOpenMenu(openMenu === id ? null : id);

  // Auto-open submenu based on current route
  useEffect(() => {
    const activeParent = navItems.find(
      (item) =>
        item.children &&
        item.children.some((child) => location.pathname.startsWith(child.path))
    );
    if (activeParent) setOpenMenu(activeParent.id);
  }, [location.pathname]);

  // ── Logout handler ──
  // logout() in auth.js already handles everything:
  // calls AUTH_API_BASE/logout.php with the login_log_id + token,
  // clears hris_token/hris_user/refresh timer, and redirects to /login.
  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="layout">
      <div className={`sidebar ${isOpen ? "open" : "collapsed"}`}>

        <button className="toggle-btn" onClick={toggleSidebar}>
          <FaBars />
        </button>

        {/* ── Main Nav Items ── */}
        <nav className="nav-top">
          {navItems.slice(0, -1).map((item) => (
            <div key={item.id}>
              {!item.children && (
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                >
                  <item.icon className="icon" />
                  {isOpen && <span>{item.label}</span>}
                </NavLink>
              )}

              {item.children && (
                <>
                  <div className="nav-link" onClick={() => toggleSubMenu(item.id)}>
                    <item.icon className="icon" />
                    {isOpen && <span>{item.label}</span>}
                    {isOpen && (
                      <FaChevronDown
                        className={`chevron ${openMenu === item.id ? "rotate" : ""}`}
                      />
                    )}
                  </div>

                  {isOpen && openMenu === item.id && (
                    <div className="submenu">
                      {item.children.map((sub) => (
                        <NavLink
                          key={sub.id}
                          to={sub.path}
                          className={({ isActive }) =>
                            `nav-link sub-link ${isActive ? "active" : ""}`
                          }
                        >
                          <sub.icon className="icon" />
                          <span>{sub.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </nav>

        {/* ── Bottom Section ── */}
        <div className="sidebar-bottom">

          {/* User Profile */}
          <div className="user-profile">
            <div className="avatar">
              {user?.first_name?.[0]?.toUpperCase() ?? "A"}
            </div>
            {isOpen && (
              <div className="user-info">
                <span className="user-name">
                  {user ? `${user.first_name} ${user.last_name}` : "Admin User"}
                </span>
                <span className="user-role">
                  {user?.role ?? "HR Administrator"}
                </span>
              </div>
            )}
          </div>

          <div className="divider" />

          {/* ── Logout Button — onClick on the whole div, works collapsed or open ── */}
          <div className="nav-link logout-link" onClick={handleLogout}>
            <LuLogOut className="icon" />
            {isOpen && <span>Logout</span>}
          </div>

        </div>
      </div>

      {isOpen && <div className="overlay" onClick={toggleSidebar} />}
    </div>
  );
}