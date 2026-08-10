import { useState, useEffect, useRef, useCallback } from "react";
import {
  LuChevronLeft, LuChevronRight, LuPrinter,
  LuWifi, LuWifiOff, LuCircle,
  LuCheck, LuX, LuClock, LuBriefcase,
  LuChartBar, LuFileText, LuDownload,
} from "react-icons/lu";

const API_BASE = import.meta.env.VITE_API_BASE;
const WS_URL   = "ws://localhost:4000";

// ─────────────────────────────────────────────────────────────────────────────
// Shared mini-components
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_BADGE = {
  Present:    { cls: "att-badge--green",  label: "Present"   },
  Late:       { cls: "att-badge--amber",  label: "Late"      },
  Absent:     { cls: "att-badge--red",    label: "Absent"    },
  "On Leave": { cls: "att-badge--blue",   label: "On Leave"  },
  Holiday:    { cls: "att-badge--purple", label: "Holiday"   },
  Pending:    { cls: "att-badge--amber",  label: "Pending"   },
  Approved:   { cls: "att-badge--green",  label: "Approved"  },
  Rejected:   { cls: "att-badge--red",    label: "Rejected"  },
};

const Badge = ({ status }) => {
  const b = STATUS_BADGE[status] || { cls: "att-badge--gray", label: status };
  return <span className={`att-badge ${b.cls}`}>{b.label}</span>;
};

const EmpCell = ({ name, sub }) => (
  <div className="att-emp-cell">
    <div className="att-avatar">{name?.[0] ?? "?"}</div>
    <div>
      <div className="att-emp-name">{name}</div>
      <div className="att-emp-no">{sub}</div>
    </div>
  </div>
);

const SkeletonRows = ({ cols, rows = 5 }) =>
  [...Array(rows)].map((_, i) => (
    <tr key={i} className="att-skeleton-row">
      {[...Array(cols)].map((_, j) => <td key={j}><div className="att-skel" /></td>)}
    </tr>
  ));

const EmptyRow = ({ cols, msg }) => (
  <tr><td colSpan={cols} className="att-empty">{msg}</td></tr>
);

const ApiMsg = ({ msg }) => msg
  ? <div className={`att-api-msg att-api-msg--${msg.type}`}>{msg.text}</div>
  : null;

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 — Daily Time Record
// ─────────────────────────────────────────────────────────────────────────────
export function TabDTR({ date, department, search, refreshKey }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const PER_PAGE = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p    = new URLSearchParams({ date: date || "", dept_id: department || "", search: search || "", page, per_page: PER_PAGE });
      const json = await fetch(`${API_BASE}/attendance_dtr.php?action=get_dtr&${p}`).then(r => r.json());
      if (json.status === "success") setRecords(json.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [date, department, search, page, refreshKey]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [date, department, search]);

  return (
    <div className="att-panel">
      <div className="att-panel-toolbar">
        <span className="att-panel-title">Daily Time Record</span>
        <button className="att-action-btn" onClick={() => window.print()}>
          <LuPrinter size={13} /> Print
        </button>
      </div>
      <div className="att-table-wrap">
        <table className="att-table">
          <thead>
            <tr>
              <th>Employee</th><th>Department</th><th>Time In</th>
              <th>Time Out</th><th>Hours</th><th>Status</th><th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? <SkeletonRows cols={7} />
              : records.length === 0
                ? <EmptyRow cols={7} msg="No records found for this date." />
                : records.map(r => (
                  <tr key={r.attendance_id}>
                    <td><EmpCell name={r.full_name} sub={r.employee_no} /></td>
                    <td className="att-td-muted">{r.dept_name}</td>
                    <td className="att-td-mono">{r.time_in  ?? "—"}</td>
                    <td className="att-td-mono">{r.time_out ?? "—"}</td>
                    <td className="att-td-mono">{r.hours_worked != null ? `${r.hours_worked}h` : "—"}</td>
                    <td><Badge status={r.status} /></td>
                    <td className="att-td-muted">{r.remarks ?? "—"}</td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
      <div className="att-pagination">
        <button className="att-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
          <LuChevronLeft size={14} />
        </button>
        <span className="att-page-label">Page {page}</span>
        <button className="att-page-btn" onClick={() => setPage(p => p + 1)} disabled={records.length < PER_PAGE}>
          <LuChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 — Live Logs
// ─────────────────────────────────────────────────────────────────────────────
const LOG_COLOR = {
  "Time In":  "att-log--green",
  "Time Out": "att-log--blue",
  "Break":    "att-log--amber",
  "Override": "att-log--red",
};

export function TabLiveLogs({ search }) {
  const [logs,      setLogs]      = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const wsRef     = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/attendance_dtr.php?action=get_logs&limit=50`)
      .then(r => r.json())
      .then(json => { if (json.status === "success") setLogs(json.data || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen    = () => setConnected(true);
      ws.onclose   = () => { setConnected(false); setTimeout(connect, 3000); };
      ws.onerror   = () => ws.close();
      ws.onmessage = e => {
        try {
          const d = JSON.parse(e.data);
          if (d.type === "attendance_log")
            setLogs(prev => [d.payload, ...prev].slice(0, 100));
        } catch {}
      };
    };
    connect();
    return () => wsRef.current?.close();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const filtered = search
    ? logs.filter(l => l.full_name?.toLowerCase().includes(search.toLowerCase()))
    : logs;

  return (
    <div className="att-panel">
      <div className="att-panel-toolbar">
        <span className="att-panel-title">Live Logs</span>
        <div className={`att-ws-badge ${connected ? "att-ws-badge--on" : "att-ws-badge--off"}`}>
          {connected ? <LuWifi size={12} /> : <LuWifiOff size={12} />}
          {connected ? "Live" : "Reconnecting…"}
        </div>
      </div>
      <div className="att-log-stream">
        {loading
          ? <div className="att-log-loading">Loading logs…</div>
          : filtered.length === 0
            ? <div className="att-empty att-empty--log">No logs yet. Waiting for activity…</div>
            : filtered.map((log, i) => (
              <div key={log.log_id ?? i} className={`att-log-row ${LOG_COLOR[log.log_type] ?? ""}`}>
                <div className="att-log-time">{log.log_time}</div>
                <div className="att-log-type">
                  <LuCircle size={7} className="att-log-dot" />{log.log_type}
                </div>
                <div className="att-log-emp">
                  <span className="att-log-name">{log.full_name}</span>
                  <span className="att-log-dept">{log.dept_name}</span>
                </div>
                <div className="att-log-device">{log.device ?? "Biometric"}</div>
              </div>
            ))
        }
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3 — Overtime
// ─────────────────────────────────────────────────────────────────────────────
export function TabOT({ date, department, search, refreshKey }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState(null);
  const [apiMsg,  setApiMsg]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p    = new URLSearchParams({ date: date || "", dept_id: department || "", search: search || "" });
      const json = await fetch(`${API_BASE}/attendance_ot_ob.php?action=get_overtime&${p}`).then(r => r.json());
      if (json.status === "success") setRecords(json.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [date, department, search, refreshKey]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (ot_id, status) => {
    setActing(ot_id); setApiMsg(null);
    try {
      const json = await fetch(`${API_BASE}/attendance_ot_ob.php`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ot_id, status, action: 'update_overtime' }),
      }).then(r => r.json());
      if (json.status === "success") {
        setRecords(p => p.map(r => r.ot_id === ot_id ? { ...r, status } : r));
        setApiMsg({ type: "success", text: `Request ${status.toLowerCase()}.` });
      } else {
        setApiMsg({ type: "error", text: json.message });
      }
    } catch { setApiMsg({ type: "error", text: "Could not reach server." }); }
    finally { setActing(null); }
  };

  return (
    <div className="att-panel">
      <div className="att-panel-toolbar">
        <span className="att-panel-title">Overtime Requests</span>
        <LuClock size={15} className="att-panel-icon" />
      </div>
      <ApiMsg msg={apiMsg} />
      <div className="att-table-wrap">
        <table className="att-table">
          <thead>
            <tr>
              <th>Employee</th><th>Date</th><th>OT Start</th><th>OT End</th>
              <th>Hours</th><th>Reason</th><th>Status</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? <SkeletonRows cols={8} />
              : records.length === 0
                ? <EmptyRow cols={8} msg="No overtime requests found." />
                : records.map(r => (
                  <tr key={r.ot_id}>
                    <td><EmpCell name={r.full_name} sub={r.dept_name} /></td>
                    <td className="att-td-muted">{r.ot_date}</td>
                    <td className="att-td-mono">{r.ot_start}</td>
                    <td className="att-td-mono">{r.ot_end}</td>
                    <td className="att-td-mono">{r.ot_hours}h</td>
                    <td className="att-td-muted">{r.reason ?? "—"}</td>
                    <td><Badge status={r.status} /></td>
                    <td>
                      {r.status === "Pending" && (
                        <div className="att-action-group">
                          <button className="att-icon-btn att-icon-btn--green"
                            disabled={acting === r.ot_id}
                            onClick={() => handleAction(r.ot_id, "Approved")}>
                            <LuCheck size={13} />
                          </button>
                          <button className="att-icon-btn att-icon-btn--red"
                            disabled={acting === r.ot_id}
                            onClick={() => handleAction(r.ot_id, "Rejected")}>
                            <LuX size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4 — Official Business
// ─────────────────────────────────────────────────────────────────────────────
export function TabOB({ date, department, search, refreshKey }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState(null);
  const [apiMsg,  setApiMsg]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p    = new URLSearchParams({ date: date || "", dept_id: department || "", search: search || "" });
      const json = await fetch(`${API_BASE}/attendance_ot_ob.php?action=get_ob&${p}`).then(r => r.json());
      if (json.status === "success") setRecords(json.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [date, department, search, refreshKey]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (ob_id, status) => {
    setActing(ob_id); setApiMsg(null);
    try {
      const json = await fetch(`${API_BASE}/attendance_ot_ob.php`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ob_id, status, action: 'update_ob' }),
      }).then(r => r.json());
      if (json.status === "success") {
        setRecords(p => p.map(r => r.ob_id === ob_id ? { ...r, status } : r));
        setApiMsg({ type: "success", text: `OB request ${status.toLowerCase()}.` });
      } else {
        setApiMsg({ type: "error", text: json.message });
      }
    } catch { setApiMsg({ type: "error", text: "Could not reach server." }); }
    finally { setActing(null); }
  };

  return (
    <div className="att-panel">
      <div className="att-panel-toolbar">
        <span className="att-panel-title">Official Business</span>
        <LuBriefcase size={15} className="att-panel-icon" />
      </div>
      <ApiMsg msg={apiMsg} />
      <div className="att-table-wrap">
        <table className="att-table">
          <thead>
            <tr>
              <th>Employee</th><th>OB Date</th><th>Destination</th><th>Purpose</th>
              <th>Time Out</th><th>Time In</th><th>Status</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? <SkeletonRows cols={8} />
              : records.length === 0
                ? <EmptyRow cols={8} msg="No official business records found." />
                : records.map(r => (
                  <tr key={r.ob_id}>
                    <td><EmpCell name={r.full_name} sub={r.dept_name} /></td>
                    <td className="att-td-muted">{r.ob_date}</td>
                    <td className="att-td-muted">{r.destination ?? "—"}</td>
                    <td className="att-td-muted">{r.purpose    ?? "—"}</td>
                    <td className="att-td-mono">{r.time_out ?? "—"}</td>
                    <td className="att-td-mono">{r.time_in  ?? "—"}</td>
                    <td><Badge status={r.status} /></td>
                    <td>
                      {r.status === "Pending" && (
                        <div className="att-action-group">
                          <button className="att-icon-btn att-icon-btn--green"
                            disabled={acting === r.ob_id}
                            onClick={() => handleAction(r.ob_id, "Approved")}>
                            <LuCheck size={13} />
                          </button>
                          <button className="att-icon-btn att-icon-btn--red"
                            disabled={acting === r.ob_id}
                            onClick={() => handleAction(r.ob_id, "Rejected")}>
                            <LuX size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 5 — Reports
// ─────────────────────────────────────────────────────────────────────────────
const REPORT_TYPES = [
  { id: "daily",     label: "Daily Attendance Summary"     },
  { id: "monthly",   label: "Monthly Summary per Employee" },
  { id: "tardiness", label: "Tardiness Report"             },
  { id: "ot",        label: "Overtime Summary"             },
  { id: "ob",        label: "Official Business Summary"    },
  { id: "absent",    label: "Absenteeism Report"           },
];

export function TabReports({ department }) {
  const [reportType, setReportType] = useState("daily");
  const [fromDate,   setFromDate]   = useState("");
  const [toDate,     setToDate]     = useState("");
  const [format,     setFormat]     = useState("csv");
  const [generating, setGenerating] = useState(false);
  const [msg,        setMsg]        = useState(null);

  const handleGenerate = async () => {
    if (!fromDate || !toDate) {
      setMsg({ type: "error", text: "Please select a date range." }); return;
    }
    setGenerating(true); setMsg(null);
    try {
      const p   = new URLSearchParams({ action: "generate_report", type: reportType, from: fromDate, to: toDate, dept_id: department || "", format });
      const res = await fetch(`${API_BASE}/attendance_reports.php?${p}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `attendance_${reportType}_${fromDate}_to_${toDate}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ type: "success", text: "Report downloaded successfully." });
    } catch { setMsg({ type: "error", text: "Failed to generate report." }); }
    finally { setGenerating(false); }
  };

  return (
    <div className="att-panel">
      <div className="att-panel-toolbar">
        <span className="att-panel-title">Generate Reports</span>
        <LuChartBar size={15} className="att-panel-icon" />
      </div>
      <ApiMsg msg={msg} />
      <div className="att-report-grid">
        <div className="att-report-types">
          <p className="att-report-section-label">Report Type</p>
          {REPORT_TYPES.map(rt => (
            <button key={rt.id}
              className={`att-report-card ${reportType === rt.id ? "att-report-card--active" : ""}`}
              onClick={() => setReportType(rt.id)}>
              <LuFileText size={14} />{rt.label}
            </button>
          ))}
        </div>
        <div className="att-report-options">
          <p className="att-report-section-label">Options</p>
          <div className="att-report-field">
            <label>From Date</label>
            <input type="date" className="att-input att-input--plain"
              value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="att-report-field">
            <label>To Date</label>
            <input type="date" className="att-input att-input--plain"
              value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="att-report-field">
            <label>Format</label>
            <select className="att-input att-input--plain att-select"
              value={format} onChange={e => setFormat(e.target.value)}>
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (XLSX)</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
          <button className="att-generate-btn" onClick={handleGenerate} disabled={generating}>
            <LuDownload size={14} />
            {generating ? "Generating…" : "Generate & Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
