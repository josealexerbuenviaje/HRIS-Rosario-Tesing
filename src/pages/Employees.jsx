import React, { useState, useEffect } from "react";
import Content from "../components/Content";
import "../css_pages/Employees.css";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function Employees() {
  const [departments, setDepartments]   = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/get_departments_with_head.php`)
      .then(r => {
        if (!r.ok) throw new Error(`Server error: ${r.status}`);
        return r.json();
      })
      .then(json => {
        if (json.status === "success" && json.data.length > 0) {
          setDepartments(json.data);
          setSelectedDept(json.data[0]); // select first dept by default
        } else {
          setError("No departments found in the database.");
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="departments-page departments-page--loading">
        <div className="loading-spinner" />
        <p>Loading departments…</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="departments-page departments-page--error">
        <p>⚠️ {error}</p>
      </div>
    );
  }

  return (
    <div className="departments-page">
      {/* LEFT SECTION */}
      <aside className="departments-sidebar">
        <div className="company-info">
          <h2>Municipality of Rosario</h2>
          <p>{departments.length} Department{departments.length !== 1 ? "s" : ""}</p>
        </div>

        {departments.map((dept) => (
          <div className="department" key={dept.dept_id}>
            <h3>{dept.dept_type}</h3>

            <div
              className={`team ${selectedDept?.dept_id === dept.dept_id ? "active" : ""}`}
              onClick={() => setSelectedDept(dept)}
            >
              <div className="team-header">
                <div>
                  <h4>{dept.dept_name}</h4>
                  <p>{dept.employee_count} Employee{dept.employee_count !== 1 ? "s" : ""}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </aside>

      {/* RIGHT SECTION */}
      {selectedDept && <Content team={selectedDept} />}
    </div>
  );
}