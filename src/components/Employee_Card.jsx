import React, { useState } from "react";
import EmployeeModal from "./Employee_detailsmodal";

function InitialsAvatar({ name, className = "emp-avatar emp-avatar--initials" }) {
  const parts    = (name || "?").trim().split(/\s+/);
  const initials = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : (parts[0]?.slice(0, 2) ?? "?");

  const colors = [
    "#16a34a","#0369a1","#0f766e","#15803d",
    "#b45309","#7c3aed","#be185d","#b91c1c",
  ];
  const bg = colors[(name?.charCodeAt(0) ?? 0) % colors.length];

  return (
    <div className={className} style={{ background: bg }}>
      {initials.toUpperCase()}
    </div>
  );
}

export { InitialsAvatar };

export default function EmployeeCard({ employee }) {
  const [showModal, setShowModal] = useState(false);

  const name   = employee.full_name
                  ?? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
                  ?? employee.name
                  ?? "—";
  const role   = employee.position_title ?? employee.role ?? "—";
  const email  = employee.email_address  ?? employee.email ?? null;
  const phone  = employee.contact_number ?? employee.phone ?? null;
  const status = employee.employment_status ?? null;
  const empNo  = employee.employee_no ?? null;

  return (
    <>
      <div
        className="employee-con"
        onClick={() => setShowModal(true)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === "Enter" && setShowModal(true)}
        title={`View ${name}'s profile`}
      >
        {employee.avatar
          ? <img className="emp-avatar" src={employee.avatar} alt={name}
              onError={e => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }} />
          : null}
        <InitialsAvatar name={name} />

        <div className="emp-info">
          <h4 className="emp-name">{name}</h4>
          <p  className="emp-role">{role}</p>

          {email && (
            <a className="emp-contact" href={`mailto:${email}`} title="Send email"
              onClick={e => e.stopPropagation()}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              {email}
            </a>
          )}

          {phone && (
            <a className="emp-contact" href={`tel:${phone}`} title="Call"
              onClick={e => e.stopPropagation()}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1
                  4.14 13a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 3.04 2.18h3a2 2 0 0 1 2 1.72
                  c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27
                  a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/>
              </svg>
              {phone}
            </a>
          )}

          <div className="emp-footer">
            {empNo && <span className="emp-badge emp-badge--id">#{empNo}</span>}
            {status && (
              <span className={`emp-badge emp-badge--status emp-badge--${status.toLowerCase().replace(/\s+/g, "-")}`}>
                {status}
              </span>
            )}
          </div>

          <span className="emp-view-hint">Click to view profile</span>
        </div>
      </div>

      <EmployeeModal
        employee={employee}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
