import React, { useState, useEffect, useRef } from 'react';
import './css_components/NewEmployeeForm.css';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE;


const APPOINTMENT_TYPES = [
  'Permanent', 'Temporary', 'Casual', 'Contractual',
  'Co-terminus', 'Elective', 'Career Executive Service',
];

const TEMPLATE_COLUMNS = [
  { key: 'last_name',        required: true  },
  { key: 'first_name',       required: true  },
  { key: 'middle_name',      required: false },
  { key: 'suffix',           required: false },
  { key: 'sex',              required: true  },
  { key: 'birth_date',       required: true  },
  { key: 'civil_status',     required: true  },
  { key: 'contact_number',   required: false },
  { key: 'email_address',    required: true  },
  { key: 'tin_no',           required: false },
  { key: 'gsis_no',          required: false },
  { key: 'philhealth_no',    required: false },
  { key: 'pagibig_no',       required: false },
  { key: 'dept_code',        required: true  },
  { key: 'position_title',   required: true  },
  { key: 'salary_grade',     required: true  },
  { key: 'step_increment',   required: false },
  { key: 'monthly_salary',   required: true  },
  { key: 'appointment_type', required: true  },
  { key: 'date_hired',       required: true  },
];

const INITIAL_FORM = {
  firstName: '', lastName: '', middleName: '', suffix: '',
  position: '', department: '', section: '', startDate: '', salary: '',
  email: '', phone: '',
  // extended LGU fields
  sex: '', birthDate: '', civilStatus: '',
  tinNo: '', gsisNo: '', philhealthNo: '', pagibigNo: '',
  salaryGrade: '', stepIncrement: '', appointmentType: '',
};

// ─── Normalize a cell value — converts Date objects → YYYY-MM-DD ─────────────
function normalizeCell(val) {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // Excel serial date numbers (rare but possible)
  if (typeof val === 'number' && val > 40000 && val < 60000) {
    const epoch = new Date(Math.round((val - 25569) * 86400 * 1000));
    const y = epoch.getUTCFullYear();
    const m = String(epoch.getUTCMonth() + 1).padStart(2, '0');
    const d = String(epoch.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).trim();
}

// Normalize all cells in every row
function normalizeRows(rows) {
  return rows.map(row => {
    const out = {};
    for (const key in row) {
      // Also normalize the key itself — trim whitespace
      out[key.trim()] = normalizeCell(row[key]);
    }
    return out;
  });
}

// ─── XLSX parser (SheetJS from CDN, CSV fallback) ─────────────────────────────
function parseFile(file) {
  return new Promise((resolve, reject) => {
    const isXlsx = /\.(xlsx|xls)$/i.test(file.name);
    const reader = new FileReader();

    if (isXlsx) {
      reader.onload = (e) => {
        const load = () => {
          try {
            const data = new Uint8Array(e.target.result);
            // cellDates:true → JS Date objects; we handle them in normalizeCell
            const wb = window.XLSX.read(data, { type: 'array', cellDates: true });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const raw = window.XLSX.utils.sheet_to_json(ws, { defval: '' });
            resolve(normalizeRows(raw));
          } catch (err) { reject(new Error('Failed to parse XLSX: ' + err.message)); }
        };
        if (window.XLSX) { load(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        s.onload = load;
        s.onerror = () => reject(new Error('Could not load XLSX parser.'));
        document.head.appendChild(s);
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        try {
          const lines = e.target.result.split('\n').filter(l => l.trim());
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          const rows = lines.slice(1).map(line => {
            const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
            return headers.reduce((o, h, i) => { o[h] = vals[i] ?? ''; return o; }, {});
          });
          resolve(normalizeRows(rows));
        } catch (err) { reject(new Error('Failed to parse CSV: ' + err.message)); }
      };
      reader.readAsText(file);
    }
  });
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

// ─── Main Component ───────────────────────────────────────────────────────────
function NewEmployeeForm({ isOpen, onClose }) {
  const [activeTab, setActiveTab]   = useState('form');
  const [formData, setFormData]     = useState(INITIAL_FORM);
  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiMessage, setApiMessage] = useState(null); // { type: 'success'|'error', text }

  // Import state
  const [dragOver, setDragOver]           = useState(false);
  const [importFile, setImportFile]       = useState(null);
  const [importData, setImportData]       = useState(null);
  const [importError, setImportError]     = useState('');
  const [importing, setImporting]         = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [skippedRows, setSkippedRows]     = useState([]);
  const fileInputRef = useRef();

  // ── Load departments from DB (tree structure for two-level picker) ───────────
  const [deptTree,   setDeptTree]   = useState([]);
  const [deptLoading, setDeptLoading] = useState(false);

  // Reset form + fetch departments when modal opens (single effect to avoid race condition)
  useEffect(() => {
    if (!isOpen) return;

    // Reset all form state
    setFormData(INITIAL_FORM);
    setErrors({});
    setActiveTab('form');
    setApiMessage(null);
    setImportFile(null);
    setImportData(null);
    setImportError('');
    setImportProgress(0);
    setSkippedRows([]);

    // Fetch department tree from DB
    setDeptLoading(true);
    fetch(`${API_BASE}/get_dept_for_employee.php`)
      .then(r => r.json())
      .then(json => {
        if (json.status === 'success' && json.data.length > 0) {
          setDeptTree(json.data);
        } else {
          throw new Error('Empty or failed response');
        }
      })
      .catch(() => {
        setDeptTree([]);
        setErrors(prev => ({ ...prev, department: 'Could not load departments. Please refresh.' }));
      })
      .finally(() => setDeptLoading(false));

  }, [isOpen]);

  // ── Form handlers ─────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const e = {};
    if (!formData.firstName)      e.firstName      = 'First name is required';
    if (!formData.lastName)       e.lastName        = 'Last name is required';
    if (!formData.position)       e.position        = 'Position is required';
    if (!formData.department)     e.department      = 'Department is required';
    if (!formData.startDate)      e.startDate       = 'Start date is required';
    if (!formData.salary)         e.salary          = 'Salary is required';
    if (!formData.sex)            e.sex             = 'Sex is required';
    if (!formData.civilStatus)    e.civilStatus     = 'Civil status is required';
    if (!formData.appointmentType)e.appointmentType = 'Appointment type is required';
    if (!formData.email) {
      e.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      e.email = 'Email is invalid';
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setApiMessage(null);

    // Map original field names → API field names
    const payload = {
      lastName:       formData.lastName,
      firstName:      formData.firstName,
      middleName:     formData.middleName,
      suffix:         formData.suffix,
      sex:            formData.sex,
      birthDate:      formData.startDate,   // reuse startDate as dateHired
      civilStatus:    formData.civilStatus,
      contactNumber:  formData.phone,
      email:          formData.email,
      tinNo:          formData.tinNo,
      gsisNo:         formData.gsisNo,
      philhealthNo:   formData.philhealthNo,
      pagibigNo:      formData.pagibigNo,
      department:     formData.department,
      section:  formData.section || null,
      positionTitle:  formData.position,
      salaryGrade:    formData.salaryGrade || '1',
      stepIncrement:  formData.stepIncrement || '1',
      monthlySalary:  formData.salary,
      appointmentType:formData.appointmentType,
      dateHired:      formData.startDate,
    };

    try {
      const res  = await fetch(`${API_BASE}/add_employee.php`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();

      if (res.ok && json.status === 'success') {
        setApiMessage({
          type: 'success',
          text: `Employee added! ID: ${json.employee_id}`,
        });
        setFormData(INITIAL_FORM);
        setErrors({});
        setTimeout(onClose, 1800);
      } else {
        setApiMessage({ type: 'error', text: json.message || 'An error occurred.' });
      }
    } catch {
      setApiMessage({ type: 'error', text: 'Could not reach the server. Is PHP running?' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData(INITIAL_FORM);
    setErrors({});
    onClose();
  };

  // ── Import handlers ───────────────────────────────────────────────────────
  const processFile = async (file) => {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setImportError('Only .xlsx, .xls, or .csv files are accepted.');
      return;
    }
    setImportFile(file);
    setImportError('');
    setImportData(null);
    setSkippedRows([]);
    try {
      const rows = await parseFile(file);
      if (!rows.length) throw new Error('The file appears to be empty.');
      setImportData(rows);
    } catch (err) {
      setImportError(err.message);
      setImportFile(null);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importData) return;

    setImporting(true);
    setImportProgress(10);
    setSkippedRows([]);
    setApiMessage(null);

    const ticker = setInterval(() => {
      setImportProgress(p => (p < 85 ? p + 5 : p));
    }, 200);

    try {
      const res  = await fetch(`${API_BASE}/import_employees.php`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(importData),
      });
      clearInterval(ticker);
      setImportProgress(100);
      const json = await res.json();

      if (res.ok && json.status === 'success') {
        const skipped = json.skipped_details || [];
        setSkippedRows(skipped);
        setApiMessage({
          type: skipped.length ? 'warning' : 'success',
          text: skipped.length
            ? `${json.inserted} imported, ${json.skipped} skipped — see details below.`
            : `${json.inserted} employee(s) imported successfully!`,
        });
        if (!skipped.length) setTimeout(onClose, 2000);
      } else {
        setApiMessage({ type: 'error', text: json.message || 'Import failed.' });
      }
    } catch {
      clearInterval(ticker);
      setApiMessage({ type: 'error', text: 'Could not reach the server. Is PHP running?' });
    } finally {
      setImporting(false);
      setTimeout(() => setImportProgress(0), 600);
    }
  };

  const clearFile = () => {
    setImportFile(null);
    setImportData(null);
    setImportError('');
    setSkippedRows([]);
    setApiMessage(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (!isOpen) return null;

  const previewCols = importData?.length ? Object.keys(importData[0]).slice(0, 6) : [];

  return (
    <div className="form-modal" role="dialog" aria-labelledby="form-title" aria-describedby="form-description">
      <div className="modal-content">

        {/* Header */}
        <h2 id="form-title">Add New Employee</h2>
        <p id="form-description">Fill in the details or import a file to add employees.</p>

        {/* ── Tabs ── */}
        <div className="tab-bar">
          <button
            type="button"
            className={`tab-btn${activeTab === 'form' ? ' tab-btn--active' : ''}`}
            onClick={() => setActiveTab('form')}
          >
            📝 Manual Entry
          </button>
          <button
            type="button"
            className={`tab-btn${activeTab === 'import' ? ' tab-btn--active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            📊 Import File
          </button>
        </div>

        {/* ── API feedback banner ── */}
        {apiMessage && (
          <div className={`api-message api-message--${apiMessage.type}`}>
            {apiMessage.type === 'success' && '✅ '}
            {apiMessage.type === 'error'   && '❌ '}
            {apiMessage.type === 'warning' && '⚠️ '}
            {apiMessage.text}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB 1 — MANUAL ENTRY FORM
        ══════════════════════════════════════════════ */}
        {activeTab === 'form' && (
          <form onSubmit={handleSubmit} className="leave-form">

            {/* ── Personal Info ── */}
            <fieldset className="form-section">
              <legend className="form-section__legend">Personal Information</legend>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name *</label>
                  <input
                    type="text" id="firstName" name="firstName"
                    value={formData.firstName} onChange={handleChange} required
                  />
                  {errors.firstName && <span className="error">{errors.firstName}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="lastName">Last Name *</label>
                  <input
                    type="text" id="lastName" name="lastName"
                    value={formData.lastName} onChange={handleChange} required
                  />
                  {errors.lastName && <span className="error">{errors.lastName}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="middleName">Middle Name</label>
                  <input
                    type="text" id="middleName" name="middleName"
                    value={formData.middleName} onChange={handleChange}
                  />
                </div>

                <div className="form-group form-group--small">
                  <label htmlFor="suffix">Suffix</label>
                  <input
                    type="text" id="suffix" name="suffix"
                    value={formData.suffix} onChange={handleChange}
                    placeholder="Jr., Sr."
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="sex">Sex *</label>
                  <select id="sex" name="sex" value={formData.sex} onChange={handleChange} required>
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  {errors.sex && <span className="error">{errors.sex}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="civilStatus">Civil Status *</label>
                  <select id="civilStatus" name="civilStatus" value={formData.civilStatus} onChange={handleChange} required>
                    <option value="">Select</option>
                    <option>Single</option>
                    <option>Married</option>
                    <option>Widowed</option>
                    <option>Separated</option>
                    <option>Legally Separated</option>
                  </select>
                  {errors.civilStatus && <span className="error">{errors.civilStatus}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Phone</label>
                  <input
                    type="tel" id="phone" name="phone"
                    value={formData.phone} onChange={handleChange}
                    placeholder="09XXXXXXXXX"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email *</label>
                  <input
                    type="email" id="email" name="email"
                    value={formData.email} onChange={handleChange} required
                  />
                  {errors.email && <span className="error">{errors.email}</span>}
                </div>
              </div>
            </fieldset>

            {/* ── Government IDs ── */}
            <fieldset className="form-section">
              <legend className="form-section__legend">Government IDs</legend>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tinNo">TIN No.</label>
                  <input type="text" id="tinNo" name="tinNo"
                    value={formData.tinNo} onChange={handleChange} placeholder="XXX-XXX-XXX" />
                </div>
                <div className="form-group">
                  <label htmlFor="gsisNo">GSIS No.</label>
                  <input type="text" id="gsisNo" name="gsisNo"
                    value={formData.gsisNo} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="philhealthNo">PhilHealth No.</label>
                  <input type="text" id="philhealthNo" name="philhealthNo"
                    value={formData.philhealthNo} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="pagibigNo">Pag-IBIG No.</label>
                  <input type="text" id="pagibigNo" name="pagibigNo"
                    value={formData.pagibigNo} onChange={handleChange} />
                </div>
              </div>
            </fieldset>

            {/* ── Employment Details ── */}
            <fieldset className="form-section">
              <legend className="form-section__legend">Employment Details</legend>

              <div className="form-row">
                <div className="form-group form-group--wide">
                  <label htmlFor="position">Position *</label>
                  <input
                    type="text" id="position" name="position"
                    value={formData.position} onChange={handleChange} required
                    placeholder="e.g. Administrative Officer IV"
                  />
                  {errors.position && <span className="error">{errors.position}</span>}
                </div>

                <div className="form-group form-group--wide">
                  <label>Department *</label>
                  {/* ── Level 1: Main Office ── */}
                  <select
                    name="department"
                    value={formData.department}
                    onChange={e => {
                      // Reset sub-dept when parent changes
                      setFormData(prev => ({ ...prev, department: e.target.value, section: '' }));
                      if (errors.department) setErrors(prev => ({ ...prev, department: '' }));
                    }}
                    required
                  >
                    <option value="">
                      {deptLoading ? 'Loading departments…' : 'Select Department'}
                    </option>
                    {deptTree.map(d => (
                      <option key={d.dept_code} value={d.dept_code}>
                        [{d.dept_code}] {d.dept_name}
                      </option>
                    ))}
                  </select>
                  {errors.department && <span className="error">{errors.department}</span>}

                  {/* ── Level 2: Section / Branch (only shown if parent has children) ── */}
                  {(() => {
                    const selected = deptTree.find(d => d.dept_code === formData.department);
                    if (!selected?.sections?.length) return null;
                    return (
                      <div className="nef-sub-dept-wrap">
                        <span className="nef-tree-line">└</span>
                        <div className="nef-sub-dept-field">
                          <label>Section / Branch <span className="nef-optional">(optional)</span></label>
                          <select
                            name="section"
                            value={formData.section}
                            onChange={handleChange}
                          >
                            <option value="">— No specific section —</option>
                            {selected.sections.map(s => (
                              <option key={s.section_id} value={s.section_id}>
                                [{s.section_code}] {s.section_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Assignment summary pill ── */}
                  {formData.department && (() => {
                    const parent = deptTree.find(d => d.dept_code === formData.department);
                    const sub    = parent?.sections?.find(s => s.section_id === formData.section);
                    return (
                      <div className="nef-dept-summary">
                        📂 {parent?.dept_name ?? formData.department}
                        {sub && <><span className="nef-dept-sep"> › </span><strong>{sub.section_name}</strong></>}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="appointmentType">Appointment Type *</label>
                  <select id="appointmentType" name="appointmentType"
                    value={formData.appointmentType} onChange={handleChange} required>
                    <option value="">Select</option>
                    {APPOINTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.appointmentType && <span className="error">{errors.appointmentType}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="startDate">Start Date *</label>
                  <input
                    type="date" id="startDate" name="startDate"
                    value={formData.startDate} onChange={handleChange} required
                  />
                  {errors.startDate && <span className="error">{errors.startDate}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="salaryGrade">Salary Grade (1–33)</label>
                  <input
                    type="number" id="salaryGrade" name="salaryGrade"
                    min="1" max="33" value={formData.salaryGrade} onChange={handleChange}
                    placeholder="e.g. 18"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="stepIncrement">Step (1–8)</label>
                  <input
                    type="number" id="stepIncrement" name="stepIncrement"
                    min="1" max="8" value={formData.stepIncrement} onChange={handleChange}
                    placeholder="1"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="salary">Monthly Salary (₱) *</label>
                  <input
                    type="number" id="salary" name="salary"
                    value={formData.salary} onChange={handleChange} required
                    placeholder="e.g. 27000"
                  />
                  {errors.salary && <span className="error">{errors.salary}</span>}
                </div>
              </div>
            </fieldset>

            {/* ── Actions ── */}
            <div className="form-actions">
              <button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Add Employee'}
              </button>
              <button type="button" onClick={handleCancel}>Cancel</button>
            </div>
          </form>
        )}

        {/* ══════════════════════════════════════════════
            TAB 2 — IMPORT FILE
        ══════════════════════════════════════════════ */}
        {activeTab === 'import' && (
          <form onSubmit={handleImportSubmit} className="leave-form import-form">

            {/* Drop zone */}
            {!importFile ? (
              <div
                className={`dropzone${dragOver ? ' dropzone--active' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current.click()}
                aria-label="Click or drag a file to upload"
              >
                <span className="dropzone__icon">📂</span>
                <p className="dropzone__title">Drop your file here</p>
                <p className="dropzone__sub">or <strong>click to browse</strong></p>
                <p className="dropzone__types">.xlsx &nbsp;·&nbsp; .xls &nbsp;·&nbsp; .csv</p>
                <input
                  ref={fileInputRef} type="file" hidden
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                />
              </div>
            ) : (
              <div className="file-chip">
                <span className="file-chip__icon">📗</span>
                <div className="file-chip__info">
                  <span className="file-chip__name">{importFile.name}</span>
                  <span className="file-chip__meta">
                    {formatBytes(importFile.size)} · {importData?.length ?? '…'} rows detected
                  </span>
                </div>
                <button type="button" className="file-chip__remove" onClick={clearFile}
                  aria-label="Remove file">✕</button>
              </div>
            )}

            {/* File parse error */}
            {importError && (
              <span className="error import-error">⚠️ {importError}</span>
            )}

            {/* Progress bar */}
            {importProgress > 0 && (
              <div className="progress-bar">
                <div className="progress-bar__fill" style={{ width: `${importProgress}%` }} />
              </div>
            )}

            {/* Detected headers debug */}
            {importData?.length > 0 && (() => {
              const detectedHeaders = Object.keys(importData[0]);
              const expectedKeys    = TEMPLATE_COLUMNS.map(c => c.key);
              const missing = expectedKeys.filter(k =>
                TEMPLATE_COLUMNS.find(c => c.key === k)?.required &&
                !detectedHeaders.some(h => [k, k.replace(/_/g,' ')].includes(h.toLowerCase().trim()))
              );
              return missing.length > 0 ? (
                <div className="import-header-warn">
                  <strong>⚠️ Detected headers:</strong>{' '}
                  <code>{detectedHeaders.join(', ')}</code>
                  <br/>
                  <strong>Possibly missing:</strong> {missing.join(', ')}
                  <br/>
                  <small>Make sure your column headers exactly match the expected names below.</small>
                </div>
              ) : null;
            })()}

            {/* Preview table */}
            {importData?.length > 0 && (
              <div className="import-preview">
                <div className="import-preview__header">
                  <span>Preview — first 5 rows</span>
                  <span className="import-preview__count">{importData.length} total rows</span>
                </div>
                <div className="import-preview__scroll">
                  <table className="import-table">
                    <thead>
                      <tr>
                        {previewCols.map(c => <th key={c}>{c}</th>)}
                        {Object.keys(importData[0]).length > 6 && <th>…</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {importData.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {previewCols.map(c => (
                            <td key={c} title={String(row[c])}>{String(row[c])}</td>
                          ))}
                          {Object.keys(row).length > 6 && <td>…</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Skipped rows (after import) */}
            {skippedRows.length > 0 && (
              <div className="skipped-rows">
                <p className="skipped-rows__title">⚠️ {skippedRows.length} row(s) skipped:</p>
                {skippedRows.map((s, i) => (
                  <p key={i} className="skipped-rows__item">Row {s.row}: {s.reason}</p>
                ))}
              </div>
            )}

            {/* Column reference */}
            <div className="column-guide">
              <p className="column-guide__title">Expected Column Headers</p>
              <div className="column-guide__cols">
                {TEMPLATE_COLUMNS.map(c => (
                  <span key={c.key}
                    className={`col-badge${c.required ? ' col-badge--required' : ''}`}>
                    {c.key}
                  </span>
                ))}
              </div>
              <p className="column-guide__legend">
                <span className="col-badge col-badge--required">required</span>
                &nbsp;
                <span className="col-badge">optional</span>
              </p>
            </div>

            {/* Actions */}
            <div className="form-actions">
              <button type="submit" disabled={!importData || importing}>
                {importing
                  ? `Importing… ${importProgress}%`
                  : `Import ${importData?.length ?? ''} Employees`}
              </button>
              <button type="button" onClick={handleCancel}>Cancel</button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}

export default NewEmployeeForm;