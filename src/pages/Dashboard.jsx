import "./css_pages/Dashboard.css";
import React, {useState} from "react";

export default function Dashboard() {
 // Calendar State and Logic
 const [currentDate, setCurrentDate] = useState(new Date());

 // For the current system date (today) to highlight in calendar
 const today = new Date();

 const year = currentDate.getFullYear();
 const month = currentDate.getMonth();

 const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

 const firstDayOfMonth = new Date(year, month, 1);
 const lastDayOfMonth = new Date(year, month + 1, 0);

 const startDay = firstDayOfMonth.getDay();
 const numberOfDays = lastDayOfMonth.getDate();

 const prevMonth = () => {
   setCurrentDate(new Date(year, month - 1, 1));
 };

 const nextMonth = () => {
   setCurrentDate(new Date(year, month + 1, 1));
 };

 // Sample activities for today, you can replace with dynamic data
 const todaysActivities = [
   {
     type: "Job Interview",
     employee: "Jerry Helfer",
     time: "10:30-11:30 am",
     typeColor: "blue", // for styling badge
   },
   {
     type: "Meeting",
     employee: "Ricky Smith",
     time: "12:00-01:30 pm",
     typeColor: "yellow",
   },
 ];

 // Create calendar cells including empty cells before month start
 const calendarCells = [];

 for (let i = 0; i < startDay; i++) {
   calendarCells.push(
     <div key={`empty-${i}`} className="calendar-cell empty"></div>
   );
 }

 for (let day = 1; day <= numberOfDays; day++) {
   // Determine if this day is today (highlight it)
   const isToday =
     day === today.getDate() &&
     month === today.getMonth() &&
     year === today.getFullYear();

   calendarCells.push(
     <div
       key={day}
       className={`calendar-cell${isToday ? " calendar-cell-today" : ""}`}
     >
       {day}
     </div>
   );
 }
    return (
      <div className="dashboard-container">
      {/* Sidebar is assumed to be separate */}

      {/* Main dashboard content */}
      <main className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header">
          <h1>Dashboard</h1>
        </header>

        {/* Top stats and chart container */}
        <section className="dashboard-top-section">
          <div className="grid-child-left">
            <div className="stats-box">
              <div className="all-employees">
                <p>All Employees</p>
                <h2>450</h2>
                <small>
                </small>
              </div>

              <div className="small-stats-grid">
                <div className="small-stat-item">
                  <p className="stat-title">Work from home</p>
                    <div className="stat-value">
                      <p>14</p>
                      <span className="stat-value-trend">12% ↑</span>
                    </div>
                </div>

                <div className="small-stat-item">
                  <p className="stat-title">On Vacation</p>
                    <div className="stat-value">
                        <p>1</p>
                        <span className="stat-value-trend">12% ↑</span>
                    </div>
                  <br />

                </div>

                <div className="small-stat-item">
                  <p className="stat-title">Day Off</p>
                  <div className="stat-value">
                      <p>0</p>
                      <span className="stat-value-trend">12% ↑</span>
                  </div>
                  <br />
                </div>

                <div className="small-stat-item">
                  <p className="stat-title">Sick Leave</p>
                    <div className="stat-value">
                        <p>5</p>
                        <span className="stat-value-trend">12% ↑</span>
                    </div>
                  <br />
                </div>
              </div>
            </div>
              {/* Interview */}
            <EmployeeCard
              title="Interview"
              employees={[
                {
                  name: "Gabiru Asano",
                  position: "Dota 2 Pro",
                  avatar: "https://randomuser.me/api/portraits/men/31.jpg",
                },
                { 
                  name: "Frances Swann", 
                  position: "Project Manager", 
                  avatar: null, 
                  initials: "FS" 
                },
                {
                  name: "Jolo Doobie",
                  position: "V.A Maniger",
                  avatar: "https://randomuser.me/api/portraits/men/16.jpg",
                },
                {
                  name: "Frances Swann", 
                  position: "Project Manager", 
                  avatar: null, 
                  initials: "FS" 
                },
                { 
                  name: "Justine Lods",
                  position: "Security Guard",
                  avatar: "https://randomuser.me/api/portraits/men/59.jpg",

                },
                {
                  name: "Rhonda Rhodes",
                  position: "SMM Manager",
                  avatar: "https://randomuser.me/api/portraits/women/68.jpg",
                },
                
              ]}
            />
          </div>
          <div className="grid-child-right">
             {/* Calendar Section */}
            <div className="calendar-container">
                <p className="calendar-title">Calendar</p>
                <div className="calendar-header">
                  <button onClick={prevMonth} className="nav-button">
                    &#8592;
                  </button>
                  <div className="month-year">
                    {currentDate.toLocaleString("default", { month: "long" })} {year}
                  </div>
                  <button onClick={nextMonth} className="nav-button">
                    &#8594;
                  </button>
                </div>

              <div className="days-row">
                {daysOfWeek.map((day) => (
                  <div key={day} className="day-label">
                    {day}
                  </div>
                ))}
              </div>
              <div className="calendar-grid">{calendarCells}</div>

              {/* Today's Activities Section */}
              <div className="todays-activities">
                <p className="activities-title">Today</p>
                {todaysActivities.map(({ type, employee, time, typeColor }, idx) => (
                  <div key={idx} className="activity-item">
                    <span className={`activity-type activity-type-${typeColor}`}>
                      {type}
                    </span>
                    <span className="activity-employee">{employee}</span>
                    <span className="activity-time">{time}</span>
                  </div>
                ))}
                <p className="view-all-activities">View all</p>
              </div>
              <p className="activities-title">Tommorow</p>
                {todaysActivities.map(({ type, employee, time, typeColor }, idx) => (
                  <div key={idx} className="activity-item">
                    <span className={`activity-type activity-type-${typeColor}`}>
                      {type}
                    </span>
                    <span className="activity-employee">{employee}</span>
                    <span className="activity-time">{time}</span>
                  </div>
                ))}
            </div>
          </div>
           
        </section>

        {/* Bottom charts */}
        <section className="bottom-charts-section">
          {/* The Amount Spent On Hiring (Bar Chart Placeholder) */}
          <div className="bottom-chart">
            <div className="bottom-chart-header">
              <p>The Amount Spent On Hiring</p>
              <small>Half A Year ▼</small>
            </div>
            <div className="bottom-chart-bars">
              {[
                { month: "Jun", height: 100 },
                { month: "Feb", height: 85 },
                { month: "Mar", height: 85 },
                { month: "Apr", height: 60 },
                { month: "May", height: 65 },
                { month: "June", height: 70 },
                { month: "July", height: 35 },
              ].map(({ month, height }) => (
                <div key={month} className="bottom-chart-bar-item">
                  <div className="bottom-chart-bar" style={{ height }}></div>
                  <small>{month}</small>
                </div>
              ))}
            </div>
            <div className="chart-caption">Cost Per Hire</div>
          </div>

          {/* Number of Employees by Year (Bar Chart Placeholder) */}
          <div className="bottom-chart inset-shadow">
            <p className="chart-title">Number of Employees by Year</p>
            <div className="bars">
              {[

              ].map(({ label, width }) => (
                <div key={label} className="bar-item">
                  <div className="bar-label muted">{label}</div>
                  <div className="bar lighter" style={{ width: `${width}%` }}></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

const EmployeeCard = ({ title, employees, showDate = false }) => (
  <div className="employee-card">
    <div className="employee-card-header">
      <h4>{title}</h4>
      <span className="view-all">View all</span>
    </div>
    <ul className="employee-list">
      {employees.map(({ name, position, avatar, initials, date, note }, idx) => (
        <li key={idx} className="employee-list-item">
          <div className="avatar">
            {avatar ? (
              <img src={avatar} alt={name} />
            ) : (
              <div className="avatar-initials">{initials}</div>
            )}
          </div>
          <div className="employee-info">
            <p className="employee-name">{name}</p>
            <p className="employee-position">{position}</p>
          </div>
          {showDate && (
            <div className="employee-date-info">
              <p className="employee-date">{date}</p>
              <p className="employee-note">{note}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  </div>
    );
  
  