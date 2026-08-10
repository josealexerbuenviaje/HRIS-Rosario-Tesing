import React from "react";

// Generates initials avatar when no photo is available
function InitialsAvatar({ name }) {
  const parts    = (name || "?").trim().split(/\s+/);
  const initials = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : parts[0]?.slice(0, 2) ?? "?";

  // Pick a consistent color based on name
  const colors = [
    "#1d4ed8","#0369a1","#0f766e","#15803d",
    "#b45309","#b91c1c","#7c3aed","#be185d",
  ];
  const colorIndex = name
    ? name.charCodeAt(0) % colors.length
    : 0;

  return (
    <div
      className="head-avatar head-avatar--initials"
      style={{ background: colors[colorIndex] }}
      aria-label={name}
    >
      {initials.toUpperCase()}
    </div>
  );
}

export default function HeadCard({ head, deptName }) {
  // head can be null if no office_head is set for the department
  if (!head) {
    return (
      <div className="head-card head-card--empty">
        <div className="head-avatar head-avatar--empty">—</div>
        <div className="head-card__info">
          <h4 className="head-card__name">No Head Assigned</h4>
          <p className="head-card__position">{deptName}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="head-card">
      {/* Avatar: use photo if available, otherwise initials */}
      {head.avatar ? (
        <img
          className="head-avatar"
          src={head.avatar}
          alt={head.full_name}
          onError={(e) => {
            // Replace broken image with initials
            e.currentTarget.style.display = "none";
            e.currentTarget.nextSibling.style.display = "flex";
          }}
        />
      ) : null}

      <InitialsAvatar name={head.full_name} />

      <div className="head-card__info">
        <span className="head-card__badge">Department Head</span>
        <h4 className="head-card__name">{head.full_name}</h4>
        <p className="head-card__position">{head.position_title || "—"}</p>

        <div className="head-card__contacts">
          {head.email_address && (
            <a
              className="head-card__contact"
              href={`mailto:${head.email_address}`}
              title="Send email"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              {head.email_address}
            </a>
          )}

          {head.contact_number && (
            <a
              className="head-card__contact"
              href={`tel:${head.contact_number}`}
              title="Call"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.14 13
                  19.79 19.79 0 0 1 1.07 4.37 2 2 0 0 1 3.04 2.18h3a2 2 0 0 1 2 1.72c.127.96.361
                  1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1
                  2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/>
              </svg>
              {head.contact_number}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}