import "./css_pages/Dashboard.css";
import React, { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER DATA
// Everything below is illustrative. Once dashboard_api.php exists, each of
// these consts gets replaced by an authFetch() call — the shape is written
// to make that swap mechanical (see comments per section).
// ─────────────────────────────────────────────────────────────────────────────

const REGISTRY_STATS = {
  totalEmployees: 450,
  plantillaFilled: 391,
  plantillaTotal: 450,
  openPostings: 6,
  applicantsInPipeline: 34,
  certsExpiringSoon: 5,
};

const APPOINTMENT_MIX = [
  { label: "Permanent", count: 268 },
  { label: "Contractual", count: 71 },
  { label: "Temporary", count: 54 },
  { label: "Casual", count: 39 },
  { label: "Co-terminus", count: 12 },
  { label: "Elective", count: 6 },
];

const GENDER_SPLIT = { male: 231, female: 219 };

const RETIRING_SOON = [
  { name: "Leonora Bautista", position: "Municipal Assessor", dept: "Assessor's Office", date: "Jan 2027" },
  { name: "Ernesto Villaruel", position: "Engineering Aide III", dept: "Engineering", date: "Mar 2027" },
  { name: "Corazon Dimaculangan", position: "Nurse II", dept: "Health Office", date: "Jun 2027" },
];

const COMPLIANCE_FLAGS = {
  missingRequiredIds: 18,
  noLeaveTakenYtd: 27,
};

const RECRUITMENT_STAGES = [
  { label: "Screening", count: 15 },
  { label: "Interview", count: 11 },
  { label: "Offered", count: 5 },
  { label: "Onboarding", count: 3 },
];

const TODAYS_ACTIVITIES = [
  { type: "Interview", person: "Jerome Villafuerte", detail: "Admin Officer IV panel", time: "10:30–11:30 AM" },
  { type: "Leave starts", person: "Marites Ocampo", detail: "Sick leave, 3 days", time: "All day" },
];

const TOMORROWS_ACTIVITIES = [
  { type: "Training", person: "General Services staff", detail: "Basic First Aid refresher", time: "9:00 AM–12:00 PM" },
  { type: "Onboarding", person: "Aldrin Manalo", detail: "New hire, Treasury", time: "8:00 AM" },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = new Date();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysOfWeek = ["S", "M", "T", "W", "T", "F", "S"];

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDay = firstDayOfMonth.getDay();
  const numberOfDays = lastDayOfMonth.getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const calendarCells = [];
  for (let i = 0; i < startDay; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="cal-cell cal-cell--empty" />);
  }
  for (let day = 1; day <= numberOfDays; day++) {
    const isToday =
      day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    calendarCells.push(
      <div key={day} className={`cal-cell${isToday ? " cal-cell--today" : ""}`}>
        {day}
      </div>
    );
  }

  const fillRate = Math.round((REGISTRY_STATS.plantillaFilled / REGISTRY_STATS.plantillaTotal) * 100);
  const vacant = REGISTRY_STATS.plantillaTotal - REGISTRY_STATS.plantillaFilled;
  const genderTotal = GENDER_SPLIT.male + GENDER_SPLIT.female;
  const appointmentTotal = APPOINTMENT_MIX.reduce((sum, a) => sum + a.count, 0);

  const todayLabel = today.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="registry">
      <main className="registry-main">

        {/* Header */}
        <header className="registry-header">
          <h1>Dashboard</h1>
          <p className="registry-date">{todayLabel}</p>
        </header>

        {/* Hero ledger row */}
        <section className="stat-strip" aria-label="Workforce overview">
          <div className="stat-strip__item">
            <span className="stat-strip__value">{REGISTRY_STATS.totalEmployees}</span>
            <span className="stat-strip__label">Total employees</span>
          </div>
          <div className="stat-strip__item">
            <span className="stat-strip__value">{fillRate}%</span>
            <span className="stat-strip__label">Plantilla filled</span>
          </div>
          <div className="stat-strip__item">
            <span className="stat-strip__value">{vacant}</span>
            <span className="stat-strip__label">Positions vacant</span>
          </div>
          <div className="stat-strip__item">
            <span className="stat-strip__value">{REGISTRY_STATS.openPostings}</span>
            <span className="stat-strip__label">Open postings</span>
          </div>
          <div className="stat-strip__item">
            <span className="stat-strip__value stat-strip__value--flag">{REGISTRY_STATS.certsExpiringSoon}</span>
            <span className="stat-strip__label">Certifications expiring</span>
          </div>
        </section>

        <div className="registry-body">
          {/* Left column */}
          <div className="registry-col">

            {/* Workforce composition */}
            <section className="panel">
              <h2 className="panel__title">Workforce composition</h2>

              <div className="composition">
                <div className="composition__group">
                  <p className="composition__label">Appointment type</p>
                  {APPOINTMENT_MIX.map(({ label, count }) => (
                    <div key={label} className="ledger-row">
                      <span className="ledger-row__label">{label}</span>
                      <div className="ledger-row__bar-track">
                        <div
                          className="ledger-row__bar-fill"
                          style={{ width: `${(count / appointmentTotal) * 100}%` }}
                        />
                      </div>
                      <span className="ledger-row__value">{count}</span>
                    </div>
                  ))}
                </div>

                <div className="composition__group">
                  <p className="composition__label">Gender distribution</p>
                  <div className="split-bar">
                    <div
                      className="split-bar__male"
                      style={{ width: `${(GENDER_SPLIT.male / genderTotal) * 100}%` }}
                    />
                    <div
                      className="split-bar__female"
                      style={{ width: `${(GENDER_SPLIT.female / genderTotal) * 100}%` }}
                    />
                  </div>
                  <div className="split-bar__legend">
                    <span><i className="dot dot--male" />Male — {GENDER_SPLIT.male}</span>
                    <span><i className="dot dot--female" />Female — {GENDER_SPLIT.female}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Needs attention */}
            <section className="panel">
              <h2 className="panel__title">Needs attention</h2>

              <div className="attention-summary">
                <div className="attention-summary__item">
                  <span className="attention-summary__count">{COMPLIANCE_FLAGS.missingRequiredIds}</span>
                  <span className="attention-summary__label">Records missing a required ID (TIN, GSIS, PhilHealth, or Pag-IBIG)</span>
                </div>
                <div className="attention-summary__item">
                  <span className="attention-summary__count">{COMPLIANCE_FLAGS.noLeaveTakenYtd}</span>
                  <span className="attention-summary__label">Employees with no leave taken this year</span>
                </div>
              </div>

              <p className="attention-sublabel">Retiring within 12 months</p>
              <ul className="person-list">
                {RETIRING_SOON.map((p) => (
                  <li key={p.name} className="person-list__item">
                    <span className="avatar-initials">
                      {p.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </span>
                    <div className="person-list__info">
                      <p className="person-list__name">{p.name}</p>
                      <p className="person-list__meta">{p.position} · {p.dept}</p>
                    </div>
                    <span className="person-list__date">{p.date}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Recruitment pipeline */}
            <section className="panel">
              <h2 className="panel__title">Recruitment pipeline</h2>
              <p className="panel__sub">{REGISTRY_STATS.applicantsInPipeline} applicants across {REGISTRY_STATS.openPostings} open postings</p>
              <div className="stage-row">
                {RECRUITMENT_STAGES.map((s, i) => (
                  <React.Fragment key={s.label}>
                    <div className="stage-row__stage">
                      <span className="stage-row__count">{s.count}</span>
                      <span className="stage-row__label">{s.label}</span>
                    </div>
                    {i < RECRUITMENT_STAGES.length - 1 && <span className="stage-row__sep">→</span>}
                  </React.Fragment>
                ))}
              </div>
            </section>
          </div>

          {/* Right column — Calendar */}
          <div className="registry-col registry-col--narrow">
            <section className="panel">
              <h2 className="panel__title">Calendar</h2>

              <div className="cal-header">
                <button onClick={prevMonth} className="cal-nav" aria-label="Previous month">‹</button>
                <span className="cal-month">
                  {currentDate.toLocaleString("default", { month: "long" })} {year}
                </span>
                <button onClick={nextMonth} className="cal-nav" aria-label="Next month">›</button>
              </div>

              <div className="cal-days-row">
                {daysOfWeek.map((d, i) => (
                  <div key={i} className="cal-day-label">{d}</div>
                ))}
              </div>
              <div className="cal-grid">{calendarCells}</div>

              <div className="activities">
                <p className="activities__title">Today</p>
                {TODAYS_ACTIVITIES.map((a, i) => (
                  <div key={i} className="activity-row">
                    <span className="activity-row__type">{a.type}</span>
                    <div className="activity-row__body">
                      <p className="activity-row__person">{a.person}</p>
                      <p className="activity-row__detail">{a.detail}</p>
                    </div>
                    <span className="activity-row__time">{a.time}</span>
                  </div>
                ))}

                <p className="activities__title">Tomorrow</p>
                {TOMORROWS_ACTIVITIES.map((a, i) => (
                  <div key={i} className="activity-row">
                    <span className="activity-row__type">{a.type}</span>
                    <div className="activity-row__body">
                      <p className="activity-row__person">{a.person}</p>
                      <p className="activity-row__detail">{a.detail}</p>
                    </div>
                    <span className="activity-row__time">{a.time}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}