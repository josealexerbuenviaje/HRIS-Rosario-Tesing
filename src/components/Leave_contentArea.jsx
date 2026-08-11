import React, { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../auth';
import '../css_components/ContentArea.css';

// ── Shared helpers ────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    Pending:  'status-badge status-pending',
    Approved: 'status-badge status-approved',
    Rejected: 'status-badge status-rejected',
    Cancelled:'status-badge status-cancelled',
  };
  return <span className={map[status] ?? 'status-badge'}>{status}</span>;
};

const ApiMsg = ({ msg }) => msg
  ? <div className={`api-msg api-msg--${msg.type}`}>{msg.text}</div>
  : null;

// ── TAB: File Leave ───────────────────────────────────────────────────────────
function TabFileLeave() {
  const [employees,   setEmployees]   = useState([]);
  const [leaveTypes,  setLeaveTypes]  = useState([]);
  const [empSearch,   setEmpSearch]   = useState('');
  const [requests,    setRequests]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [apiMsg,      setApiMsg]      = useState(null);

  const [form, setForm] = useState({
    employee_id: '', leave_type_id: '', start_date: '',
    end_date: '', reason: '',
  });

  // Load leave types on mount
  useEffect(() => {
    authFetch(`leave_api.php?action=get_leave_types`)
      .then(r => r.json())
      .then(json => { if (json.status === 'success') setLeaveTypes(json.data); })
      .catch(console.error);
  }, []);

  // Load recent requests on mount
  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const json = await authFetch(`leave_api.php?action=get_requests&status=All`)
        .then(r => r.json());
      if (json.status === 'success') setRequests(json.data.slice(0, 10));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  // Search employees
  useEffect(() => {
    if (empSearch.length < 2) { setEmployees([]); return; }
    const t = setTimeout(async () => {
      try {
        const json = await authFetch(
          `leave_api.php?action=get_employees&search=${encodeURIComponent(empSearch)}`
        ).then(r => r.json());
        if (json.status === 'success') setEmployees(json.data);
      } catch (e) { console.error(e); }
    }, 300);
    return () => clearTimeout(t);
  }, [empSearch]);

  const selectedEmp = employees.find(e => e.employee_id === form.employee_id);

  // Filter leave types — hide maternity for male employees
  const availableTypes = leaveTypes.filter(lt => {
    if (!selectedEmp) return true;
    if (lt.for_female_only && selectedEmp.sex?.toLowerCase() !== 'Female') return false;
    return true;
  });

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    setApiMsg(null);
  };

  const handleSelectEmp = emp => {
    setForm(p => ({ ...p, employee_id: emp.employee_id }));
    setEmpSearch(`${emp.full_name} (${emp.employee_no})`);
    setEmployees([]);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true); setApiMsg(null);
    try {
      const res  = await authFetch(`leave_api.php?action=file_leave`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setApiMsg({ type: 'success', text: `${json.message} (${json.days} working day/s)` });
        setForm({ employee_id:'', leave_type_id:'', start_date:'', end_date:'', reason:'' });
        setEmpSearch('');
        loadRequests();
      } else {
        setApiMsg({ type: 'error', text: json.message });
      }
    } catch { setApiMsg({ type: 'error', text: 'Could not reach server.' }); }
    finally { setSubmitting(false); }
  };

  const handleReset = () => {
    setForm({ employee_id:'', leave_type_id:'', start_date:'', end_date:'', reason:'' });
    setEmpSearch(''); setEmployees([]); setApiMsg(null);
  };

  return (
    <div className="tab-content">
      <h2>File Leave</h2>
      <p>File a leave request on behalf of an employee. All fields marked with * are required.</p>

      <ApiMsg msg={apiMsg} />

      <form onSubmit={handleSubmit} className="leave-form">

        {/* Employee selector */}
        <label htmlFor="emp-search">Employee *</label>
        <div className="emp-search-wrap">
          <input
            id="emp-search"
            type="text"
            placeholder="Search by name or employee no…"
            value={empSearch}
            onChange={e => { setEmpSearch(e.target.value); setForm(p => ({ ...p, employee_id: '' })); }}
            autoComplete="off"
          />
          {employees.length > 0 && (
            <div className="emp-dropdown">
              {employees.map(emp => (
                <div key={emp.employee_id} className="emp-option" onClick={() => handleSelectEmp(emp)}>
                  <span className="emp-option-name">{emp.full_name}</span>
                  <span className="emp-option-meta">{emp.employee_no} · {emp.dept_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {selectedEmp && (
          <div className="emp-selected-badge">
            👤 {selectedEmp.full_name} — {selectedEmp.position_title} ({selectedEmp.dept_name})
          </div>
        )}

        {/* Leave type */}
        <label htmlFor="leave_type_id">Leave Type *</label>
        <select id="leave_type_id" name="leave_type_id" value={form.leave_type_id} onChange={handleChange} required>
          <option value="">Select Type</option>
          {availableTypes.map(lt => (
            <option key={lt.leave_type_id} value={lt.leave_type_id}>{lt.leave_name}</option>
          ))}
        </select>

        {/* Dates */}
        <label htmlFor="start_date">Start Date *</label>
        <input type="date" id="start_date" name="start_date" value={form.start_date} onChange={handleChange} required />

        <label htmlFor="end_date">End Date *</label>
        <input type="date" id="end_date" name="end_date" value={form.end_date}
          min={form.start_date} onChange={handleChange} required />

        {/* Reason */}
        <label htmlFor="reason">Reason</label>
        <textarea id="reason" name="reason" value={form.reason} onChange={handleChange}
          maxLength="500" placeholder="Optional: provide details…" />

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="submit" disabled={submitting || !form.employee_id}>
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
          <button type="button" className="btn-danger" onClick={handleReset}>Cancel</button>
        </div>
      </form>

      {/* Recent requests */}
      <h3>Recent Requests</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Employee</th><th>Type</th><th>Start</th><th>End</th><th>Days</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? <tr><td colSpan={6} style={{ textAlign:'center', color:'#94a3b8' }}>Loading…</td></tr>
            : requests.length === 0
              ? <tr><td colSpan={6} style={{ textAlign:'center', color:'#94a3b8' }}>No requests yet.</td></tr>
              : requests.map(r => (
                <tr key={r.leave_id}>
                  <td>{r.full_name}</td>
                  <td>{r.leave_name}</td>
                  <td>{r.start_date}</td>
                  <td>{r.end_date}</td>
                  <td>{r.days_applied}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))
          }
        </tbody>
      </table>
    </div>
  );
}

// ── TAB: Approvals ────────────────────────────────────────────────────────────
function TabApprovals() {
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [acting,    setActing]    = useState(null);
  const [apiMsg,    setApiMsg]    = useState(null);
  const [status,    setStatus]    = useState('Pending');
  const [search,    setSearch]    = useState('');
  const [comment,   setComment]   = useState('');
  const [selected,  setSelected]  = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p    = new URLSearchParams({ action:'get_requests', status, search });
      const json = await authFetch(`leave_api.php?${p}`).then(r => r.json());
      if (json.status === 'success') setRecords(json.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [status, search]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (leave_id, action) => {
    setActing(leave_id); setApiMsg(null);
    try {
      const res  = await authFetch(`leave_api.php?action=update_status`, {
        method: 'POST',
        body: JSON.stringify({ leave_id, status: action, comment }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setRecords(p => p.map(r => r.leave_id === leave_id ? { ...r, status: action } : r));
        setApiMsg({ type: 'success', text: json.message });
      } else {
        setApiMsg({ type: 'error', text: json.message });
      }
    } catch { setApiMsg({ type: 'error', text: 'Could not reach server.' }); }
    finally { setActing(null); }
  };

  const handleBulk = async action => {
    for (const id of selected) await handleAction(id, action);
    setSelected([]);
  };

  const toggleSelect = id =>
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const toggleAll = () =>
    setSelected(selected.length === records.length ? [] : records.map(r => r.leave_id));

  return (
    <div className="tab-content">
      <h2>Approvals</h2>
      <p>Review and approve or reject pending leave requests.</p>

      <ApiMsg msg={apiMsg} />

      <div className="filters">
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="All">All</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
        <input type="text" placeholder="Search by employee…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th><input type="checkbox" checked={selected.length === records.length && records.length > 0}
              onChange={toggleAll} /></th>
            <th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? <tr><td colSpan={8} style={{ textAlign:'center', color:'#94a3b8' }}>Loading…</td></tr>
            : records.length === 0
              ? <tr><td colSpan={8} style={{ textAlign:'center', color:'#94a3b8' }}>No requests found.</td></tr>
              : records.map(r => (
                <tr key={r.leave_id}>
                  <td><input type="checkbox" checked={selected.includes(r.leave_id)}
                    onChange={() => toggleSelect(r.leave_id)} /></td>
                  <td>
                    <div style={{ fontWeight:600 }}>{r.full_name}</div>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>{r.dept_name}</div>
                  </td>
                  <td>{r.leave_name}</td>
                  <td>{r.start_date} to {r.end_date}</td>
                  <td>{r.days_applied}</td>
                  <td>{r.reason ?? '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    {r.status === 'Pending' && (
                      <div className="approval-btn">
                        <button className="btn-approve" disabled={acting === r.leave_id}
                          onClick={() => handleAction(r.leave_id, 'Approved')}>Approve</button>
                        <button className="btn-reject" disabled={acting === r.leave_id}
                          onClick={() => handleAction(r.leave_id, 'Rejected')}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
          }
        </tbody>
      </table>

      {selected.length > 0 && (
        <div className="bulk-actions">
          <span>{selected.length} selected</span>
          <button onClick={() => handleBulk('Approved')}>Approve Selected</button>
          <button onClick={() => handleBulk('Rejected')}>Reject Selected</button>
        </div>
      )}
    </div>
  );
}

// ── TAB: Leave Reports ────────────────────────────────────────────────────────
function TabLeaveReports() {
  const [from,       setFrom]       = useState('');
  const [to,         setTo]         = useState('');
  const [type,       setType]       = useState('individual');
  const [generating, setGenerating] = useState(false);
  const [msg,        setMsg]        = useState(null);

  const handleGenerate = async () => {
    if (!from || !to) { setMsg({ type:'error', text:'Please select a date range.' }); return; }
    setGenerating(true); setMsg(null);
    try {
      const p   = new URLSearchParams({ action:'generate_report', type, from, to, format:'csv' });
      const res = await authFetch(`leave_api.php?${p}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `leave_report_${from}_to_${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ type:'success', text:'Report downloaded.' });
    } catch { setMsg({ type:'error', text:'Failed to generate report.' }); }
    finally { setGenerating(false); }
  };

  return (
    <div className="tab-content">
      <h2>Leave Reports</h2>
      <ApiMsg msg={msg} />
      <form className="report-form" onSubmit={e => e.preventDefault()}>
        <label>Report Type</label>
        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="individual">Individual</option>
          <option value="department">Department</option>
        </select>
        <label>Date Range Start</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <label>End</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        <button type="button" onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating…' : 'Generate Report'}
        </button>
      </form>
    </div>
  );
}

// ── TAB: Calendar ─────────────────────────────────────────────────────────────
function TabCalendar() {
  const today = new Date();
  const [month,   setMonth]   = useState(today.getMonth() + 1);
  const [year,    setYear]    = useState(today.getFullYear());
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  useEffect(() => {
    setLoading(true);
    authFetch(`leave_api.php?action=get_calendar&month=${month}&year=${year}`)
      .then(r => r.json())
      .then(json => { if (json.status === 'success') setEntries(json.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [month, year]);

  // Build calendar days
  const firstDay    = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const getLeaveForDay = day => {
    const d = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return entries.filter(e => e.start_date <= d && e.end_date >= d);
  };

  return (
    <div className="tab-content">
      <h2>Calendar</h2>
      <div className="calendar-controls">
        <select value={month} onChange={e => setMonth(+e.target.value)}>
          {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(+e.target.value)}>
          {[year-1, year, year+1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="calendar-grid">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="cal-header-cell">{d}</div>
        ))}
        {[...Array(firstDay)].map((_, i) => (
          <div key={`empty-${i}`} className="day day--empty" />
        ))}
        {[...Array(daysInMonth)].map((_, i) => {
          const day    = i + 1;
          const leaves = getLeaveForDay(day);
          const isToday =
            day   === today.getDate() &&
            month === today.getMonth() + 1 &&
            year  === today.getFullYear();
          return (
            <div key={day} className={`day${leaves.length ? ' day--has-leave' : ''}${isToday ? ' day--today' : ''}`}>
              <span className="day-num">{day}</span>
              {leaves.slice(0, 2).map((l, j) => (
                <div key={j} className="cal-leave-chip" title={`${l.full_name} — ${l.leave_name}`}>
                  {l.full_name.split(',')[0]}
                </div>
              ))}
              {leaves.length > 2 && <div className="cal-more">+{leaves.length - 2} more</div>}
            </div>
          );
        })}
      </div>

      <div className="legend">
        <span className="legend-item your-leave">On Leave</span>
        <span className="legend-item holiday">Holiday</span>
      </div>
    </div>
  );
}

// ── TAB: Credits ──────────────────────────────────────────────────────────────
function TabCredits() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [deptId,  setDeptId]  = useState('');
  const [depts,   setDepts]   = useState([]);

  // Load departments for filter
  useEffect(() => {
    authFetch(`get_departments_with_head.php?status=Active`)
      .then(r => r.json())
      .then(json => { if (json.status === 'success') setDepts(json.data || []); })
      .catch(console.error);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p    = new URLSearchParams({ action:'get_credits', search, dept_id: deptId });
      const json = await authFetch(`leave_api.php?${p}`).then(r => r.json());
      if (json.status === 'success') setRecords(json.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, deptId]);

  useEffect(() => { load(); }, [load]);

  const CreditCell = ({ total, used, remaining, show = true }) => {
    if (!show) return <td colSpan={3} style={{ textAlign:'center', color:'#cbd5e1' }}>N/A</td>;
    return (
      <>
        <td style={{ textAlign:'center' }}>{total ?? 0}</td>
        <td style={{ textAlign:'center', color:'#dc2626' }}>{used ?? 0}</td>
        <td style={{ textAlign:'center', color:'#16a34a', fontWeight:600 }}>{remaining ?? 0}</td>
      </>
    );
  };

  return (
    <div className="tab-content">
      <h2>Leave Credits</h2>
      <p>Annual, sick, and maternity leave balances per employee.</p>

      <div className="filters">
        <input type="text" placeholder="Search employee…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select value={deptId} onChange={e => setDeptId(e.target.value)}>
          <option value="">All Departments</option>
          {depts.map(d => (
            <option key={d.dept_id} value={d.dept_id}>[{d.dept_code}] {d.dept_name}</option>
          ))}
        </select>
      </div>

      <div style={{ overflowX:'auto' }}>
        <table className="data-table credits-table">
          <thead>
            <tr>
              <th rowSpan={2}>Employee</th>
              <th rowSpan={2}>Department</th>
              <th rowSpan={2}>Position</th>
              <th colSpan={3} className="credit-group credit-group--annual">Annual Leave</th>
              <th colSpan={3} className="credit-group credit-group--sick">Sick Leave</th>
              <th colSpan={3} className="credit-group credit-group--maternity">Maternity Leave</th>
            </tr>
            <tr>
              <th className="credit-sub">Total</th>
              <th className="credit-sub">Used</th>
              <th className="credit-sub">Balance</th>
              <th className="credit-sub">Total</th>
              <th className="credit-sub">Used</th>
              <th className="credit-sub">Balance</th>
              <th className="credit-sub">Total</th>
              <th className="credit-sub">Used</th>
              <th className="credit-sub">Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? <tr><td colSpan={12} style={{ textAlign:'center', color:'#94a3b8' }}>Loading…</td></tr>
              : records.length === 0
                ? <tr><td colSpan={12} style={{ textAlign:'center', color:'#94a3b8' }}>No records found.</td></tr>
                : records.map(r => {
                  const isFemale = r.sex?.toLowerCase() === 'female';
                  return (
                    <tr key={r.employee_id}>
                      <td>
                        <div style={{ fontWeight:600 }}>{r.full_name}</div>
                        <div style={{ fontSize:11, color:'#94a3b8' }}>{r.employee_no}</div>
                      </td>
                      <td>{r.dept_name}</td>
                      <td style={{ fontSize:12, color:'#64748b' }}>{r.position_title}</td>
                      <CreditCell total={r.annual_total}    used={r.annual_used}    remaining={r.annual_remaining} />
                      <CreditCell total={r.sick_total}      used={r.sick_used}      remaining={r.sick_remaining} />
                      <CreditCell
                        total={r.maternity_total}
                        used={r.maternity_used}
                        remaining={r.maternity_remaining}
                        show={isFemale}
                      />
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
function ContentArea() {
  const [activeTab, setActiveTab] = useState('fileLeave');

  const TABS = [
    { id: 'fileLeave',    label: 'File Leave'    },
    { id: 'approvals',    label: 'Approvals'     },
    { id: 'leaveReports', label: 'Leave Reports' },
    { id: 'calendar',     label: 'Calendar'      },
    { id: 'credits',      label: 'Credits'       },
  ];

  return (
    <div className="content-area">
      <nav className="tabs" role="tablist">
        {TABS.map(tab => (
          <button key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
            role="tab">
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'fileLeave'    && <TabFileLeave />}
      {activeTab === 'approvals'    && <TabApprovals />}
      {activeTab === 'leaveReports' && <TabLeaveReports />}
      {activeTab === 'calendar'     && <TabCalendar />}
      {activeTab === 'credits'      && <TabCredits />}
    </div>
  );
}

export default ContentArea;
