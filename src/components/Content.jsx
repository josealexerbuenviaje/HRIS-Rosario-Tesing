import React, { useState } from "react";
import HeadCard        from "./HeadCard";
import EmployeeCard    from "./Employee_Card";
import NewEmployeeForm from "./NewEmployeeForm";

export default function Content({ team }) {
  const [search, setSearch]     = useState("");
  const [showForm, setShowForm] = useState(false);

  if (!team) return null;

  const employees = team.employees ?? [];

  const filtered = employees.filter(emp => {
    const q = search.toLowerCase();
    return (
      (emp.full_name      ?? "").toLowerCase().includes(q) ||
      (emp.position_title ?? "").toLowerCase().includes(q) ||
      (emp.email_address  ?? "").toLowerCase().includes(q) ||
      (emp.employee_no    ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <main className="content-area">

      {/* Header */}
      <div className="content-header">
        <div>
          <h2 className="content-title">{team.dept_name}</h2>
          <p className="content-subtitle">
            {team.dept_type} &nbsp;·&nbsp;
            <span>{employees.length} Employee{employees.length !== 1 ? "s" : ""}</span>
          </p>
        </div>

        <div className="content-actions">
          {/* Search */}
          <div className="content-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search employees…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Add Employee button */}
          <button className="btn" onClick={() => setShowForm(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ marginRight: 6, verticalAlign: "middle" }}>
              <path d="M5 12h14"/><path d="M12 5v14"/>
            </svg>
            Add Employee
          </button>
        </div>
      </div>

      {/* Add Employee Modal */}
      <NewEmployeeForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
      />

      {/* Department Head */}
      <div className="content-section-label">Department Head</div>
      <HeadCard head={team.head} deptName={team.dept_name} />

      {/* Employees grid */}
      <div className="content-section-label">
        Employees
        {search
          ? <span className="content-count">{filtered.length} of {employees.length}</span>
          : <span className="content-count">{employees.length}</span>
        }
      </div>

      {filtered.length === 0 ? (
        <div className="content-empty">
          {search
            ? `No employees match "${search}"`
            : "No employees assigned to this department yet."}
        </div>
      ) : (
        <div className="employees-grid">
          {filtered.map(emp => (
            <EmployeeCard key={emp.employee_id} employee={emp} />
          ))}
        </div>
      )}

    </main>
  );
}
