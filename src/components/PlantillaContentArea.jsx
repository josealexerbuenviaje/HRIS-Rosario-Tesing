import React, { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../auth';
import { useConfirm } from "./useConfirm";
import '../css_components/ContentArea.css';
import TableSkeleton from "./TableSkeleton";

// ── Shared ────────────────────────────────────────────────────────────────────
const ApiMsg = ({ msg }) => msg
  ? <div className={`api-msg api-msg--${msg.type}`}>{msg.text}</div>
  : null;

const StatusBadge = ({ status }) => {
  const map = { Vacant: 'plt-badge--vacant', Occupied: 'plt-badge--occupied',
                Open: 'plt-badge--open', Closed: 'plt-badge--closed' };
  return <span className={`plt-badge ${map[status] ?? ''}`}>{status}</span>;
};
// ── Field component — defined OUTSIDE PositionModal so it doesn't remount on every keystroke ──
function Field({ label, name, required, type = 'text', children, form, errors, onChange }) {
  return (
    <div className="plt-field">
      <label className="plt-label">{label}{required && <span className="plt-req"> *</span>}</label>
      {children ?? (
        <input className={`plt-input${errors[name] ? ' plt-input--err' : ''}`}
          type={type} name={name} value={form[name] ?? ''} onChange={onChange} />
      )}
      {errors[name] && <span className="plt-err-msg">{errors[name]}</span>}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// ADD / EDIT POSITION MODAL
// ─────────────────────────────────────────────────────────────────────────────
function PositionModal({ position, depts, onClose, onSaved }) {
  const isEdit = !!position?.position_id;
  const EMPTY  = { position_title:'', dept_id:'', salary_grade:'', monthly_salary:'',
                   item_number:'', status:'Vacant', remarks:'' };

  const [form,   setForm]   = useState(isEdit ? { ...position } : EMPTY);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiMsg, setApiMsg] = useState(null);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const validate = () => {
    const e = {};
    if (!form.position_title?.trim()) e.position_title = 'Required';
    if (!form.dept_id)               e.dept_id         = 'Required';
    if (!form.salary_grade)          e.salary_grade    = 'Required';
    const sg = parseInt(form.salary_grade);
    if (sg < 1 || sg > 33)          e.salary_grade    = 'Must be 1–33';
    return e;
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setApiMsg(null);
    const action = isEdit ? 'update_position' : 'add_position';
    try {
      const res  = await authFetch(`plantilla_api.php?action=${action}`, {
        method: 'POST', body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setApiMsg({ type: 'success', text: json.message });
        setTimeout(() => { onSaved(); onClose(); }, 700);
      } else {
        setApiMsg({ type: 'error', text: json.message });
      }
    } catch { setApiMsg({ type: 'error', text: 'Could not reach server.' }); }
    finally { setSaving(false); }
  };

  return (
    <div className="plt-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="plt-modal">
        <div className="plt-modal-header">
          <div className="plt-modal-icon">{isEdit ? '✏️' : '🗂️'}</div>
          <div>
            <h3 className="plt-modal-title">{isEdit ? 'Edit Position' : 'Add Position'}</h3>
            <p className="plt-modal-sub">{isEdit ? `ID: ${position.position_id}` : 'Add a new plantilla position'}</p>
          </div>
          <button className="plt-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off">
          <ApiMsg msg={apiMsg} />
          <div className="plt-modal-body">
            <p className="plt-section-title">Position Info</p>
            <div className="plt-form-grid plt-form-grid--2">
              <Field label="Item Number" name="item_number" form={form} errors={errors} onChange={handleChange}>
                <input className="plt-input plt-input--mono" name="item_number"
                  value={form.item_number ?? ''} onChange={handleChange}
                  placeholder="Auto-generated if blank" />
              </Field>
              <Field label="Status" name="status" form={form} errors={errors} onChange={handleChange}>
                <select className="plt-input" name="status" value={form.status ?? 'Vacant'} onChange={handleChange}>
                  <option>Vacant</option>
                  <option>Occupied</option>
                </select>
              </Field>
            </div>
            <Field label="Position Title" name="position_title" required form={form} errors={errors} onChange={handleChange}>
              <input className={`plt-input${errors.position_title ? ' plt-input--err' : ''}`}
                name="position_title" value={form.position_title ?? ''} onChange={handleChange}
                placeholder="e.g. Administrative Officer IV" />
            </Field>
            <div className="plt-form-grid plt-form-grid--2">
            <Field label="Department" name="dept_id" required form={form} errors={errors} onChange={handleChange}>
                <select className={`plt-input${errors.dept_id ? ' plt-input--err' : ''}`}
                  name="dept_id" value={form.dept_id ?? ''} onChange={handleChange}>
                  <option value="">— Select —</option>
                  {depts.map(d => (
                    <option key={d.dept_id} value={d.dept_id}>[{d.dept_code}] {d.dept_name}</option>
                  ))}
                </select>
                {errors.dept_id && <span className="plt-err-msg">{errors.dept_id}</span>}
              </Field>
              <Field label="Salary Grade (1–33)" name="salary_grade" required type="number" form={form} errors={errors} onChange={handleChange}>
                <input className={`plt-input${errors.salary_grade ? ' plt-input--err' : ''}`}
                  type="number" name="salary_grade" min="1" max="33"
                  value={form.salary_grade ?? ''} onChange={handleChange} />
                {errors.salary_grade && <span className="plt-err-msg">{errors.salary_grade}</span>}
              </Field>
            </div>
            <Field label="Monthly Salary (₱)" name="monthly_salary" type="number" form={form} errors={errors} onChange={handleChange}>
              <input className="plt-input" type="number" name="monthly_salary"
                value={form.monthly_salary ?? ''} onChange={handleChange}
                placeholder="Auto-filled from salary schedule" />
            </Field>
            <Field label="Remarks" name="remarks" form={form} errors={errors} onChange={handleChange}>
              <textarea className="plt-input plt-textarea" name="remarks"
                value={form.remarks ?? ''} onChange={handleChange}
                placeholder="Optional notes…" rows={2} />
            </Field>
          </div>
          <div className="plt-modal-footer">
            <button type="button" className="plt-btn plt-btn--cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="plt-btn plt-btn--save" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? '💾 Save Changes' : '➕ Add Position'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: Positions
// ─────────────────────────────────────────────────────────────────────────────
function TabPositions() {
  const [positions, setPositions] = useState([]);
  const [depts,     setDepts]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [deptId,    setDeptId]    = useState('');
  const [statusF,   setStatusF]   = useState('All');
  const [modal,     setModal]     = useState(null); // null | 'add' | position obj
  const [deleting,  setDeleting]  = useState(null);
  const [apiMsg,    setApiMsg]    = useState(null);
  const { confirm, ConfirmDialog } = useConfirm();
  // Load depts once
  useEffect(() => {
    authFetch(`get_departments_with_head.php?status=Active`)
      .then(r => r.json())
      .then(json => { if (json.status === 'success') setDepts(json.data || []); })
      .catch(console.error);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p    = new URLSearchParams({ action:'get_positions', search, dept_id: deptId, status: statusF });
      const json = await authFetch(`plantilla_api.php?${p}`).then(r => r.json());
      if (json.status === 'success') setPositions(json.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, deptId, statusF]);

  useEffect(() => { load(); }, [load]);

const handleDelete = async (posId) => {
  const ok = await confirm("Remove this position?");
  if (!ok) return;
  setDeleting(posId); setApiMsg(null);
    try {
      const res  = await authFetch(`plantilla_api.php?action=delete_position`, {
        method: 'POST', body: JSON.stringify({ position_id: posId }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setPositions(p => p.filter(x => x.position_id !== posId));
        setApiMsg({ type: 'success', text: json.message });
      } else {
        setApiMsg({ type: 'error', text: json.message });
      }
    } catch { setApiMsg({ type: 'error', text: 'Could not reach server.' }); }
    finally { setDeleting(null); }
  };

  const vacant   = positions.filter(p => p.status === 'Vacant').length;
  const occupied = positions.filter(p => p.status === 'Occupied').length;

  return (
    <div className="tab-content">
      <div className="plt-tab-header">
        <div>
          <h2>Positions</h2>
          <p>View and manage authorized plantilla positions.</p>
        </div>
        <button className="plt-add-btn" onClick={() => setModal('new')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Position
        </button>
      </div>

      {/* Summary chips */}
      <div className="plt-summary">
        <span className="plt-chip plt-chip--total">Total: {positions.length}</span>
        <span className="plt-chip plt-chip--occupied">Occupied: {occupied}</span>
        <span className="plt-chip plt-chip--vacant">Vacant: {vacant}</span>
      </div>

      <ApiMsg msg={apiMsg} />

      {/* Filters */}
      <div className="filters">
        <input type="text" placeholder="Search by title or item no…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select value={deptId} onChange={e => setDeptId(e.target.value)}>
          <option value="">All Departments</option>
          {depts.map(d => <option key={d.dept_id} value={d.dept_id}>[{d.dept_code}] {d.dept_name}</option>)}
        </select>
        <select value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="All">All Status</option>
          <option>Vacant</option>
          <option>Occupied</option>
        </select>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Item No.</th>
            <th>Position Title</th>
            <th>Department</th>
            <th>SG</th>
            <th>Monthly Salary</th>
            <th>Incumbent</th>
            <th>Status</th>
            <th style={{ textAlign:'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? <TableSkeleton columns={8} rows={5} />
            : positions.length === 0
              ? <tr><td colSpan={8} style={{ textAlign:'center', color:'#94a3b8', padding:'24px' }}>No positions found.</td></tr>
              : positions.map(pos => (
              <tr key={pos.position_id}>
                <td><span style={{ fontFamily:'monospace', fontSize:12 }}>{pos.item_number}</span></td>
                <td style={{ fontWeight:600 }}>{pos.position_title}</td>
                <td>{pos.dept_name}</td>
                <td style={{ textAlign:'center' }}>SG-{pos.salary_grade}</td>
                <td>₱{Number(pos.monthly_salary).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                <td style={{ fontSize:12.5, color: pos.incumbent_name ? '#0f172a' : '#94a3b8' }}>
                  {pos.incumbent_name ?? '—'}
                </td>
                <td><StatusBadge status={pos.status} /></td>
                <td>
                  <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                    <button className="btn-sm btn-sm--edit" onClick={() => setModal(pos)}>Edit</button>
                    <button className="btn-sm btn-sm--delete"
                      disabled={deleting === pos.position_id}
                      onClick={() => handleDelete(pos.position_id)}>
                      {deleting === pos.position_id ? '…' : 'Remove'}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          }
        </tbody>
      </table>

      {modal && (
        <PositionModal
          position={modal === 'new' ? null : modal}
          depts={depts}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
      {ConfirmDialog}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: Salaries
// ─────────────────────────────────────────────────────────────────────────────
function TabSalaries() {
  const [salaries, setSalaries] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editRow,  setEditRow]  = useState(null);
  const [editVals, setEditVals] = useState({});
  const [saving,   setSaving]   = useState(false);
  const [apiMsg,   setApiMsg]   = useState(null);

  useEffect(() => {
    authFetch(`plantilla_api.php?action=get_salaries`)
      .then(r => r.json())
      .then(json => { if (json.status === 'success') setSalaries(json.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const startEdit = sal => {
    setEditRow(sal.salary_grade);
    setEditVals({ ...sal });
  };

  const handleSave = async sg => {
    setSaving(true); setApiMsg(null);
    try {
      const res  = await authFetch(`plantilla_api.php?action=update_salary`, {
        method: 'POST', body: JSON.stringify({ salary_grade: sg, ...editVals }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setSalaries(p => p.map(s => s.salary_grade === sg ? { ...s, ...editVals } : s));
        setEditRow(null);
        setApiMsg({ type: 'success', text: 'Salary schedule updated.' });
      } else {
        setApiMsg({ type: 'error', text: json.message });
      }
    } catch { setApiMsg({ type: 'error', text: 'Could not reach server.' }); }
    finally { setSaving(false); }
  };

  return (
    <div className="tab-content">
      <h2>Salaries</h2>
      <p>DBM-approved salary schedule. Click <strong>Update</strong> on any row to edit step amounts.</p>
      <ApiMsg msg={apiMsg} />
      <div style={{ overflowX:'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>SG</th>
              {[1,2,3,4,5,6,7,8].map(s => <th key={s} style={{ textAlign:'right' }}>Step {s}</th>)}
              <th style={{ textAlign:'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? <TableSkeleton columns={10} rows={5} />
              : salaries.map(sal => (
                <tr key={sal.salary_grade}>
                  <td><strong>SG-{sal.salary_grade}</strong></td>
                  {[1,2,3,4,5,6,7,8].map(s => (
                    <td key={s} style={{ textAlign:'right' }}>
                      {editRow === sal.salary_grade
                        ? <input type="number" className="plt-input plt-input--compact"
                            value={editVals[`step_${s}`] ?? 0}
                            onChange={e => setEditVals(p => ({ ...p, [`step_${s}`]: e.target.value }))} />
                        : `₱${Number(sal[`step_${s}`]).toLocaleString('en-PH')}`
                      }
                    </td>
                  ))}
                  <td style={{ textAlign:'right' }}>
                    {editRow === sal.salary_grade
                      ? <>
                          <button className="btn-sm btn-sm--edit" disabled={saving}
                            onClick={() => handleSave(sal.salary_grade)}>
                            {saving ? '…' : 'Save'}
                          </button>
                          <button className="btn-sm btn-sm--delete" onClick={() => setEditRow(null)}>
                            Cancel
                          </button>
                        </>
                      : <button className="btn-sm btn-sm--edit" onClick={() => startEdit(sal)}>Update</button>
                    }
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
// TAB: Vacancies
// ─────────────────────────────────────────────────────────────────────────────
function TabVacancies() {
  const [vacancies, setVacancies] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [acting,    setActing]    = useState(null);
  const [apiMsg,    setApiMsg]    = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p    = new URLSearchParams({ action:'get_vacancies', search });
      const json = await authFetch(`plantilla_api.php?${p}`).then(r => r.json());
      if (json.status === 'success') setVacancies(json.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handlePost = async posId => {
    setActing(posId); setApiMsg(null);
    try {
      const res  = await authFetch(`plantilla_api.php?action=post_vacancy`, {
        method: 'POST', body: JSON.stringify({ position_id: posId }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setApiMsg({ type: 'success', text: json.message });
        load();
      } else { setApiMsg({ type: 'error', text: json.message }); }
    } catch { setApiMsg({ type: 'error', text: 'Could not reach server.' }); }
    finally { setActing(null); }
  };

  const handleClose = async vacId => {
    setActing(vacId); setApiMsg(null);
    try {
      const res  = await authFetch(`plantilla_api.php?action=close_vacancy`, {
        method: 'POST', body: JSON.stringify({ vacancy_id: vacId }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setApiMsg({ type: 'success', text: json.message });
        load();
      } else { setApiMsg({ type: 'error', text: json.message }); }
    } catch { setApiMsg({ type: 'error', text: 'Could not reach server.' }); }
    finally { setActing(null); }
  };

  return (
    <div className="tab-content">
      <h2>Vacancies</h2>
      <p>Track and post vacant plantilla positions for recruitment.</p>
      <ApiMsg msg={apiMsg} />
      <div className="filters">
        <input type="text" placeholder="Search by position title…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Position Title</th>
            <th>Department</th>
            <th>SG</th>
            <th>Monthly Salary</th>
            <th>Posted Date</th>
            <th>Closing Date</th>
            <th>Status</th>
            <th style={{ textAlign:'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? <TableSkeleton columns={8} rows={5} />
            : vacancies.length === 0
              ? <tr><td colSpan={8} style={{ textAlign:'center', color:'#94a3b8', padding:'24px' }}>No vacancies found.</td></tr>
              : vacancies.map(v => (
                <tr key={v.position_id}>
                  <td style={{ fontWeight:600 }}>{v.position_title}</td>
                  <td>{v.dept_name}</td>
                  <td style={{ textAlign:'center' }}>SG-{v.salary_grade}</td>
                  <td>₱{Number(v.monthly_salary).toLocaleString('en-PH', { minimumFractionDigits:2 })}</td>
                  <td>{v.posted_date ?? '—'}</td>
                  <td>{v.closing_date ?? '—'}</td>
                  <td><StatusBadge status={v.vacancy_status ?? 'Not Posted'} /></td>
                  <td>
                    <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                      {!v.vacancy_id && (
                        <button className="btn-sm btn-sm--edit"
                          disabled={acting === v.position_id}
                          onClick={() => handlePost(v.position_id)}>Post</button>
                      )}
                      {v.vacancy_id && v.vacancy_status === 'Open' && (
                        <button className="btn-sm btn-sm--delete"
                          disabled={acting === v.vacancy_id}
                          onClick={() => handleClose(v.vacancy_id)}>Close</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
          }
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: Reports
// ─────────────────────────────────────────────────────────────────────────────
function TabReports() {
  const [type,       setType]       = useState('position_summary');
  const [from,       setFrom]       = useState('');
  const [to,         setTo]         = useState('');
  const [generating, setGenerating] = useState(false);
  const [msg,        setMsg]        = useState(null);

  const handleGenerate = async () => {
    setGenerating(true); setMsg(null);
    try {
      const p   = new URLSearchParams({ action:'generate_report', type, from, to, format:'csv' });
      const res = await authFetch(`plantilla_api.php?${p}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `plantilla_${type}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ type:'success', text:'Report downloaded.' });
    } catch { setMsg({ type:'error', text:'Failed to generate report.' }); }
    finally { setGenerating(false); }
  };

  return (
    <div className="tab-content">
      <h2>Reports</h2>
      <p>Generate plantilla reports for CSC submission and auditing.</p>
      <ApiMsg msg={msg} />
      <form className="report-form" onSubmit={e => e.preventDefault()}>
        <label>Report Type</label>
        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="position_summary">Position Summary</option>
          <option value="vacancy_report">Vacancy Report</option>
          <option value="salary_breakdown">Salary Breakdown</option>
        </select>
        <label>Start Date</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <label>End Date</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        <button type="button" onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating…' : 'Generate Report'}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: Updates
// ─────────────────────────────────────────────────────────────────────────────
function TabUpdates() {
  const [updates,  setUpdates]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ change_type:'', description:'' });
  const [saving,   setSaving]   = useState(false);
  const [apiMsg,   setApiMsg]   = useState(null);

  const CHANGE_TYPES = ['New Position','Reclassification','Abolition','Salary Update','Vacancy Posted','Other'];

  useEffect(() => {
    authFetch(`plantilla_api.php?action=get_updates`)
      .then(r => r.json())
      .then(json => { if (json.status === 'success') setUpdates(json.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleLog = async e => {
    e.preventDefault();
    if (!form.change_type || !form.description) {
      setApiMsg({ type:'error', text:'Both fields are required.' }); return;
    }
    setSaving(true); setApiMsg(null);
    try {
      const res  = await authFetch(`plantilla_api.php?action=log_update`, {
        method: 'POST', body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setApiMsg({ type:'success', text:'Update logged.' });
        setForm({ change_type:'', description:'' });
        setShowForm(false);
        // Prepend to list
        setUpdates(p => [{
          update_id: json.update_id, change_type: form.change_type,
          description: form.description, created_at: new Date().toISOString().slice(0,19).replace('T',' '),
          changed_by: 'You',
        }, ...p]);
      } else { setApiMsg({ type:'error', text: json.message }); }
    } catch { setApiMsg({ type:'error', text:'Could not reach server.' }); }
    finally { setSaving(false); }
  };

  return (
    <div className="tab-content">
      <div className="plt-tab-header">
        <div>
          <h2>Updates</h2>
          <p>Audit log of all plantilla changes.</p>
        </div>
        <button className="plt-add-btn" onClick={() => setShowForm(p => !p)}>
          {showForm ? '✕ Cancel' : '+ Log Update'}
        </button>
      </div>

      <ApiMsg msg={apiMsg} />

      {showForm && (
        <form className="plt-log-form" onSubmit={handleLog}>
          <div className="plt-form-grid plt-form-grid--2">
            <div className="plt-field">
              <label className="plt-label">Change Type <span className="plt-req">*</span></label>
              <select className="plt-input" value={form.change_type}
                onChange={e => setForm(p => ({ ...p, change_type: e.target.value }))}>
                <option value="">— Select —</option>
                {CHANGE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="plt-field" style={{ gridColumn:'1 / -1' }}>
              <label className="plt-label">Description <span className="plt-req">*</span></label>
              <textarea className="plt-input plt-textarea" rows={2}
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Describe the change…" />
            </div>
          </div>
          <button type="submit" className="plt-btn plt-btn--save" disabled={saving}>
            {saving ? 'Saving…' : '📝 Log Update'}
          </button>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Change Type</th>
            <th>Description</th>
            <th>Changed By</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? <TableSkeleton columns={4} rows={5} />
            : updates.length === 0
              ? <tr><td colSpan={4} style={{ textAlign:'center', color:'#94a3b8', padding:'24px' }}>No updates yet.</td></tr>
              : updates.map(u => (
                <tr key={u.update_id}>
                  <td style={{ whiteSpace:'nowrap', fontSize:12.5, color:'#64748b' }}>{u.created_at}</td>
                  <td><span className="plt-badge plt-badge--update">{u.change_type}</span></td>
                  <td>{u.description}</td>
                  <td style={{ fontSize:12.5, color:'#64748b' }}>{u.changed_by ?? '—'}</td>
                </tr>
              ))
          }
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
function PlantillaContentArea() {
  const [activeTab, setActiveTab] = useState('positions');

  const TABS = [
    { id: 'positions', label: 'Positions' },
    { id: 'salaries',  label: 'Salaries'  },
    { id: 'vacancies', label: 'Vacancies' },
    { id: 'reports',   label: 'Reports'   },
    { id: 'updates',   label: 'Updates'   },
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
      {activeTab === 'positions' && <TabPositions />}
      {activeTab === 'salaries'  && <TabSalaries />}
      {activeTab === 'vacancies' && <TabVacancies />}
      {activeTab === 'reports'   && <TabReports />}
      {activeTab === 'updates'   && <TabUpdates />}
    </div>
  );
}

export default PlantillaContentArea;
