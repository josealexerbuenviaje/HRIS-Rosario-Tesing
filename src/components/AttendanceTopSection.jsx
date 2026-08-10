import { useState, useEffect, useCallback } from "react";
import {
  LuCalendar, LuFilter, LuSearch, LuDownload,
  LuRefreshCw, LuUsers, LuClock, LuUserX, LuUmbrellaOff, LuTimer,
} from "react-icons/lu";
import "../css_components/attendance.css";
import { TabDTR, TabLiveLogs, TabOT, TabOB, TabReports } from "./Attendance_Content";

const API_BASE = import.meta.env.VITE_API_BASE;

const TABS = [
  { id: "dtr",     label: "Daily Time Record" },
  { id: "logs",    label: "Live Logs"         },
  { id: "ot",      label: "Overtime"          },
  { id: "ob",      label: "Official Business" },
  { id: "reports", label: "Reports"           },
];

const STAT_CONFIG = [
  { key: "present",  label: "Present",  icon: LuUsers,       color: "green"  },
  { key: "late",     label: "Late",     icon: LuClock,       color: "amber"  },
  { key: "absent",   label: "Absent",   icon: LuUserX,       color: "red"    },
  { key: "on_leave", label: "On Leave", icon: LuUmbrellaOff, color: "blue"   },
  { key: "overtime", label: "Overtime", icon: LuTimer,       color: "purple" },
];

export default function AttendanceTopSection() {
  const [activeTab,  setActiveTab]  = useState("dtr");
  const [search,     setSearch]     = useState("");
  const [date,       setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [department, setDepartment] = useState("");
  const [depts,      setDepts]      = useState([]);
  const [stats,      setStats]      = useState({ present:0, late:0, absent:0, on_leave:0, overtime:0 });
  const [syncing,    setSyncing]    = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load departments for filter dropdown
  useEffect(() => {
    fetch(`${API_BASE}/get_departments_with_head.php?status=Active`)
      .then(r => r.json())
      .then(json => { if (json.status === "success") setDepts(json.data || []); })
      .catch(console.error);
  }, []);

  // Load stat cards
  const fetchStats = useCallback(async () => {
    try {
      const p    = new URLSearchParams({ date, dept_id: department });
      const json = await fetch(`${API_BASE}/attendance_dtr.php?action=get_stats&${p}`).then(r => r.json());
      if (json.status === "success") setStats(json.data);
    } catch (e) { console.error(e); }
  }, [date, department]);

  useEffect(() => { fetchStats(); }, [fetchStats, refreshKey]);

  // Sync Logs button
  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch(`${API_BASE}/attendance_dtr.php?action=sync_logs`, { method: "POST" });
      setRefreshKey(k => k + 1);
    } catch (e) { console.error(e); }
    finally { setSyncing(false); }
  };

  // Export button — downloads today's DTR as CSV
  const handleExport = async () => {
    setExporting(true);
    try {
      const p   = new URLSearchParams({ action: "generate_report", type: "daily", from: date, to: date, dept_id: department, format: "csv" });
      const res = await fetch(`${API_BASE}/attendance_reports.php?${p}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `attendance_${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
  };

  return (
    <div className="att-shell">

      {/* ── Hero Header ── */}
      <div className="att-hero">
        <div className="att-hero-left">
          <div className="att-hero-icon"><LuClock size={20} /></div>
          <div>
            <h1 className="att-hero-title">Attendance</h1>
            <p className="att-hero-sub">
              {new Date().toLocaleDateString("en-PH", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="att-hero-actions">
          <button className="att-btn att-btn--ghost" onClick={handleExport} disabled={exporting}>
            <LuDownload size={14} /> {exporting ? "Exporting…" : "Export"}
          </button>
          <button className="att-btn att-btn--primary" onClick={handleSync} disabled={syncing}>
            <LuRefreshCw size={14} className={syncing ? "att-spin" : ""} />
            {syncing ? "Syncing…" : "Sync Logs"}
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="att-stats">
        {STAT_CONFIG.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className={`att-stat att-stat--${s.color}`}
              style={{ animationDelay: `${i * 60}ms` }}>
              <div className="att-stat-icon"><Icon size={16} /></div>
              <div className="att-stat-body">
                <span className="att-stat-value">{stats[s.key] ?? 0}</span>
                <span className="att-stat-label">{s.label}</span>
              </div>
              <div className="att-stat-glow" />
            </div>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div className="att-filters">
        <div className="att-input-wrap">
          <LuCalendar size={14} className="att-input-icon" />
          <input className="att-input" type="date" value={date}
            onChange={e => setDate(e.target.value)} />
        </div>
        <div className="att-input-wrap">
          <LuFilter size={14} className="att-input-icon" />
          <select className="att-input att-select" value={department}
            onChange={e => setDepartment(e.target.value)}>
            <option value="">All Departments</option>
            {depts.map(d => (
              <option key={d.dept_id} value={d.dept_id}>
                [{d.dept_code}] {d.dept_name}
              </option>
            ))}
          </select>
        </div>
        <div className="att-input-wrap att-input-wrap--grow">
          <LuSearch size={14} className="att-input-icon" />
          <input className="att-input" type="text" placeholder="Search employee…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="att-clear" onClick={() => setSearch("")}>✕</button>}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="att-tabbar">
        {TABS.map(tab => (
          <button key={tab.id}
            className={`att-tab ${activeTab === tab.id ? "att-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}>
            {tab.label}
            {activeTab === tab.id && <span className="att-tab-pip" />}
          </button>
        ))}
      </div>

      {/* ── Tab Content — rendered from AttendanceContent.jsx ── */}
      <div className="att-tab-content">
        {activeTab === "dtr"     && <TabDTR      date={date} department={department} search={search} refreshKey={refreshKey} />}
        {activeTab === "logs"    && <TabLiveLogs search={search} />}
        {activeTab === "ot"      && <TabOT       date={date} department={department} search={search} refreshKey={refreshKey} />}
        {activeTab === "ob"      && <TabOB       date={date} department={department} search={search} refreshKey={refreshKey} />}
        {activeTab === "reports" && <TabReports  department={department} />}
      </div>

    </div>
  );
}
