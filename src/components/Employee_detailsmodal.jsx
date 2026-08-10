import React, { useState, useEffect } from "react";
import { InitialsAvatar } from "./Employee_Card";

const API_BASE = import.meta.env.VITE_API_BASE;

const TABS = [
  { key: "personal",    label: "Personal",    icon: "👤" },
  { key: "contact",     label: "Contact",     icon: "📞" },
  { key: "employment",  label: "Employment",  icon: "💼" },
  { key: "government",  label: "Gov't IDs",   icon: "🪪" },
  { key: "other",       label: "Other",       icon: "📋" },
];

const OPTS = {
  sex:          ["Male", "Female"],
  civil:        ["Single", "Married", "Widowed", "Separated", "Legally Separated"],
  blood:        ["A+","A-","B+","B-","AB+","AB-","O+","O-"],
  appointment:  ["Permanent","Temporary","Casual","Contractual","Co-terminus","Elective","Career Executive Service"],
  emp_status:   ["Probationary","Permanent","Casual","Separated","Retired","AWOL","Deceased"],
  separation:   ["Resigned","Retired","Dropped from Rolls","Death","End of Contract","Transferred","Other"],
};

// ─── Reusable field components ────────────────────────────────────────────────
function ReadField({ label, value, wide }) {
  const display = (value !== null && value !== undefined && value !== '') ? value : null;
  return (
    <div className={`em-field${wide ? " em-field--wide" : ""}`}>
      <span className="em-field__label">{label}</span>
      {display !== null
        ? <span className="em-field__value">{display}</span>
        : <span className="em-field__value em-field__value--empty">—</span>
      }
    </div>
  );
}

function EditField({ label, name, value, onChange, type = "text", required, wide, placeholder }) {
  return (
    <div className={`em-field em-field--edit${wide ? " em-field--wide" : ""}`}>
      <label className="em-field__label">
        {label}{required && <span className="em-req"> *</span>}
      </label>
      <input
        className="em-input"
        type={type}
        name={name}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder ?? ""}
      />
    </div>
  );
}

function EditSelect({ label, name, value, onChange, options, required, wide }) {
  return (
    <div className={`em-field em-field--edit${wide ? " em-field--wide" : ""}`}>
      <label className="em-field__label">
        {label}{required && <span className="em-req"> *</span>}
      </label>
      <select className="em-input" name={name} value={value ?? ""} onChange={onChange}>
        <option value="">— Select —</option>
        {options.map(o => (
          <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
        ))}
      </select>
    </div>
  );
}

function EditTextarea({ label, name, value, onChange, wide }) {
  return (
    <div className={`em-field em-field--edit${wide ? " em-field--wide" : ""}`}>
      <label className="em-field__label">{label}</label>
      <textarea
        className="em-input em-textarea"
        name={name}
        value={value ?? ""}
        onChange={onChange}
        rows={3}
      />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="em-section">
      <p className="em-section__title">{title}</p>
      <div className="em-section__body">{children}</div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function EmployeeModal({ employee, isOpen, onClose, onUpdated }) {
  const [activeTab, setActiveTab] = useState("personal");
  const [editing,   setEditing]   = useState(false);
  const [form,      setForm]      = useState({});
  const [saving,    setSaving]    = useState(false);
  const [apiMsg,    setApiMsg]    = useState(null);
  const [deptTree, setDeptTree] = useState([]);

  // Load department tree for the two-level picker
  useEffect(() => {
    fetch(`${API_BASE}/get_dept_for_employee.php`)
      .then(r => r.json())
      .then(json => { if (json.status === "success") setDeptTree(json.data || []); })
      .catch(() => {});
  }, []);

  // Sanitize MySQL zero-dates before storing in form state
  const cleanDates = (obj) => {
    const DATE_FIELDS = ['birth_date','date_hired','date_regularized','date_separated'];
    const out = { ...obj };
    DATE_FIELDS.forEach(f => {
      const v = out[f];
      if (!v || v === '0000-00-00' || v === '0000-00-00 00:00:00') {
        out[f] = '';
      } else {
        out[f] = String(v).slice(0, 10); // keep yyyy-MM-dd only
      }
    });
    return out;
  };

  useEffect(() => {
    if (isOpen && employee) {
      setActiveTab("personal");
      setEditing(false);
      setApiMsg(null);
      setForm(cleanDates(employee));
    }
  }, [isOpen, employee]);

  useEffect(() => {
    if (!isOpen) return;
    const h = e => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isOpen]);

  if (!isOpen || !employee) return null;

  const name   = `${form.first_name ?? ""} ${form.last_name ?? ""}`.trim() || form.full_name || "—";
  const role   = form.position_title ?? "—";
  const status = form.employment_status ?? null;
  const empNo  = form.employee_no ?? null;

  const fmt = d => {
    if (!d || d === '0000-00-00') return null;
    const date = new Date(String(d).slice(0, 10));
    return isNaN(date) ? null : date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  };
  const peso = n => (!n && n !== 0) ? null : "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 });
  const yrs  = d => {
    if (!d) return null;
    const diff = Math.floor((new Date() - new Date(d)) / (365.25 * 24 * 3600 * 1000));
    return `${diff} year${diff !== 1 ? "s" : ""}`;
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleClose = () => { setEditing(false); setApiMsg(null); onClose(); };

  const handleDiscard = () => { setEditing(false); setForm({ ...employee }); setApiMsg(null); };

  const handleSave = async () => {
    setSaving(true);
    setApiMsg(null);
    try {
      const res  = await fetch(`${API_BASE}/update_employee.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok && json.status === "success") {
        setApiMsg({ type: "success", text: "Changes saved successfully!" });
        setEditing(false);
        if (onUpdated) onUpdated({ ...form });
      } else {
        setApiMsg({ type: "error", text: json.message || "Failed to save." });
      }
    } catch {
      setApiMsg({ type: "error", text: "Could not reach the server." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="em-overlay" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="em-modal" role="dialog" aria-label={`${name} profile`}>

        {/* ── Header ── */}
        <div className="em-header">
          <div className="em-header__avatar">
            {employee.avatar
              ? <img src={employee.avatar} alt={name} className="em-avatar" />
              : <InitialsAvatar name={name} className="em-avatar em-avatar--initials" />
            }
          </div>

          <div className="em-header__info">
            <div className="em-header__top">
              <div>
                <h2 className="em-name">{name}</h2>
                <p className="em-role">{role}</p>
              </div>
              <div className="em-header__actions">
                {!editing ? (
                  <button className="em-btn em-btn--edit" onClick={() => setEditing(true)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit
                  </button>
                ) : (
                  <>
                    <button className="em-btn em-btn--save" onClick={handleSave} disabled={saving}>
                      {saving ? "Saving…" : "✓ Save"}
                    </button>
                    <button className="em-btn em-btn--cancel" onClick={handleDiscard}>Discard</button>
                  </>
                )}
                <button className="em-close" onClick={handleClose} aria-label="Close">✕</button>
              </div>
            </div>

            <div className="em-header__badges">
              {empNo  && <span className="em-badge em-badge--id">#{empNo}</span>}
              {status && <span className={`em-badge em-badge--${status.toLowerCase().replace(/\s+/g,"-")}`}>{status}</span>}
              {form.appointment_type && <span className="em-badge em-badge--apt">{form.appointment_type}</span>}
              {form.date_hired && <span className="em-badge em-badge--service">⏱ {yrs(form.date_hired)} of service</span>}
              {editing && <span className="em-badge em-badge--editing">✏️ Editing</span>}
            </div>
          </div>
        </div>

        {/* API message */}
        {apiMsg && (
          <div className={`em-api-msg em-api-msg--${apiMsg.type}`}>
            {apiMsg.type === "success" ? "✅" : "❌"} {apiMsg.text}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="em-tabs">
          {TABS.map(t => (
            <button key={t.key}
              className={`em-tab ${activeTab === t.key ? "em-tab--active" : ""}`}
              onClick={() => setActiveTab(t.key)}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="em-body">

          {/* ━━━ PERSONAL ━━━ */}
          {activeTab === "personal" && (editing ? (
            <>
              <Section title="Name">
                <EditField label="Last Name"   name="last_name"   value={form.last_name}   onChange={handleChange} required />
                <EditField label="First Name"  name="first_name"  value={form.first_name}  onChange={handleChange} required />
                <EditField label="Middle Name" name="middle_name" value={form.middle_name} onChange={handleChange} />
                <EditField label="Suffix"      name="suffix"      value={form.suffix}      onChange={handleChange} placeholder="Jr., Sr., II" />
              </Section>
              <Section title="Personal Details">
                <EditSelect label="Sex"          name="sex"          value={form.sex}          onChange={handleChange} options={OPTS.sex}   required />
                <EditSelect label="Civil Status" name="civil_status" value={form.civil_status} onChange={handleChange} options={OPTS.civil} required />
                <EditField  label="Birth Date"   name="birth_date"   value={form.birth_date ?? ""}  onChange={handleChange} type="date" required />
                <EditField  label="Place of Birth" name="place_of_birth" value={form.place_of_birth} onChange={handleChange} />
                <EditField  label="Citizenship"  name="citizenship"  value={form.citizenship}  onChange={handleChange} />
              </Section>
              <Section title="Physical Information">
                <EditSelect label="Blood Type"  name="blood_type" value={form.blood_type} onChange={handleChange} options={OPTS.blood} />
                <EditField  label="Height (m)"  name="height_m"   value={form.height_m}   onChange={handleChange} type="number" placeholder="e.g. 1.65" />
                <EditField  label="Weight (kg)" name="weight_kg"  value={form.weight_kg}  onChange={handleChange} type="number" placeholder="e.g. 60" />
              </Section>
            </>
          ) : (
            <>
              <Section title="Name">
                <ReadField label="Last Name"   value={form.last_name} />
                <ReadField label="First Name"  value={form.first_name} />
                <ReadField label="Middle Name" value={form.middle_name} />
                <ReadField label="Suffix"      value={form.suffix} />
              </Section>
              <Section title="Personal Details">
                <ReadField label="Sex"            value={form.sex} />
                <ReadField label="Civil Status"   value={form.civil_status} />
                <ReadField label="Birth Date"     value={fmt(form.birth_date)} />
                <ReadField label="Place of Birth" value={form.place_of_birth} />
                <ReadField label="Citizenship"    value={form.citizenship} />
              </Section>
              <Section title="Physical Information">
                <ReadField label="Blood Type"  value={form.blood_type} />
                <ReadField label="Height"      value={form.height_m   ? `${form.height_m} m`  : null} />
                <ReadField label="Weight"      value={form.weight_kg  ? `${form.weight_kg} kg` : null} />
              </Section>
            </>
          ))}

          {/* ━━━ CONTACT ━━━ */}
          {activeTab === "contact" && (editing ? (
            <>
              <Section title="Contact Details">
                <EditField label="Email Address"  name="email_address"  value={form.email_address}  onChange={handleChange} type="email" required />
                <EditField label="Contact Number" name="contact_number" value={form.contact_number} onChange={handleChange} placeholder="09XXXXXXXXX" />
              </Section>
              <Section title="Addresses">
                <EditField label="Permanent Address"    name="address_permanent"   value={form.address_permanent}   onChange={handleChange} wide />
                <EditField label="Residential Address"  name="address_residential" value={form.address_residential} onChange={handleChange} wide />
              </Section>
            </>
          ) : (
            <>
              <Section title="Contact Details">
                <ReadField label="Email Address"  value={form.email_address} />
                <ReadField label="Contact Number" value={form.contact_number} />
              </Section>
              <Section title="Addresses">
                <ReadField label="Permanent Address"   value={form.address_permanent}   wide />
                <ReadField label="Residential Address" value={form.address_residential} wide />
              </Section>
            </>
          ))}

          {/* ━━━ EMPLOYMENT ━━━ */}
          {activeTab === "employment" && (editing ? (
            <>
              <Section title="Identity">
                <EditField label="Employee ID"  name="employee_id" value={form.employee_id} onChange={handleChange} required />
                <EditField label="Employee No." name="employee_no" value={form.employee_no} onChange={handleChange} required />
              </Section>
              <Section title="Position & Department">
                <EditField  label="Position Title"   name="position_title"   value={form.position_title}   onChange={handleChange} wide required />

                {/* ── Two-level Department Picker ── */}
                <div className={`em-field em-field--edit em-field--wide`}>
                  <label className="em-field__label">Department <span className="em-req"> *</span></label>
                  <select
                    className="em-input"
                    name="dept_id"
                    value={form.dept_id ?? ""}
                    onChange={e => {
                      // reset sub_dept when parent changes
                      setForm(prev => ({ ...prev, dept_id: e.target.value, section_id: "" }));
                    }}
                  >
                    <option value="">— Select Department —</option>
                    {deptTree.map(d => (
                      <option key={d.dept_id} value={d.dept_id}>
                        [{d.dept_code}] {d.dept_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ── Section / Branch — only if selected parent has children ── */}
                {(() => {
                  const parent = deptTree.find(d => d.dept_id === form.dept_id);
                  if (!parent?.sections?.length) return null;
                  return (
                    <div className="em-field em-field--edit em-field--wide">
                      <label className="em-field__label">
                        Section / Branch
                        <span className="em-optional"> (optional)</span>
                      </label>
                      <div className="em-sub-dept-wrap">
                        <span className="em-tree-line">└</span>
                        <select
                          className="em-input em-input--sub"
                          name="section_id"
                          value={form.section_id ?? ""}
                          onChange={handleChange}
                        >
                          <option value="">— No specific section —</option>
                          {parent.sections.map(s => (
                            <option key={s.section_id} value={s.section_id}>
                              [{s.section_code}] {s.section_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Assignment summary ── */}
                {form.dept_id && (() => {
                  const parent = deptTree.find(d => d.dept_id === form.dept_id);
                  const sub    = parent?.sections?.find(s => s.section_id === form.section_id);
                  return (
                    <div className="em-field em-field--wide">
                      <div className="em-dept-summary">
                        📂 <span>{parent?.dept_name ?? form.dept_id}</span>
                        {sub && <><span className="em-dept-sep"> › </span><strong>{sub.section_name}</strong></>}
                      </div>
                    </div>
                  );
                })()}

                <EditSelect label="Appointment Type" name="appointment_type" value={form.appointment_type} onChange={handleChange} options={OPTS.appointment} required />
                <EditSelect label="Employment Status"name="employment_status"value={form.employment_status}onChange={handleChange} options={OPTS.emp_status} required />
              </Section>
              <Section title="Compensation">
                <EditField  label="Salary Grade (1–33)" name="salary_grade"   value={form.salary_grade}   onChange={handleChange} type="number" />
                <EditField  label="Step Increment (1–8)"name="step_increment" value={form.step_increment} onChange={handleChange} type="number" />
                <EditField  label="Monthly Salary (₱)"  name="monthly_salary" value={form.monthly_salary} onChange={handleChange} type="number" />
              </Section>
              <Section title="Service Dates">
                <EditField label="Date Hired"       name="date_hired"       value={form.date_hired ?? ""}       onChange={handleChange} type="date" required />
                <EditField label="Date Regularized" name="date_regularized" value={form.date_regularized ?? ""} onChange={handleChange} type="date" />
                <EditField label="Date Separated"   name="date_separated"   value={form.date_separated ?? ""}   onChange={handleChange} type="date" />
                <EditSelect label="Separation Cause" name="separation_cause" value={form.separation_cause} onChange={handleChange} options={OPTS.separation} />
              </Section>
            </>
          ) : (
            <>
              <Section title="Identity">
                <ReadField label="Employee ID"  value={form.employee_id} />
                <ReadField label="Employee No." value={form.employee_no} />
              </Section>
              <Section title="Position & Department">
                <ReadField label="Position Title"    value={form.position_title} wide />
                <ReadField label="Department"        value={form.dept_name ?? form.dept_id} />
                <ReadField label="Section / Branch"  value={form.section_name ?? (form.section_id || null)} />
                <ReadField label="Appointment Type"  value={form.appointment_type} />
                <ReadField label="Employment Status" value={form.employment_status} />
              </Section>
              <Section title="Compensation">
                <ReadField label="Salary Grade"   value={form.salary_grade   ? `SG-${form.salary_grade}`    : null} />
                <ReadField label="Step Increment" value={form.step_increment ? `Step ${form.step_increment}` : null} />
                <ReadField label="Monthly Salary" value={peso(form.monthly_salary)} />
              </Section>
              <Section title="Service Dates">
                <ReadField label="Date Hired"       value={fmt(form.date_hired)} />
                <ReadField label="Years of Service" value={yrs(form.date_hired)} />
                <ReadField label="Date Regularized" value={fmt(form.date_regularized)} />
                <ReadField label="Date Separated"   value={fmt(form.date_separated)} />
                <ReadField label="Separation Cause" value={form.separation_cause} />
              </Section>
            </>
          ))}

          {/* ━━━ GOVERNMENT IDs ━━━ */}
          {activeTab === "government" && (editing ? (
            <Section title="Government-Issued IDs">
              <EditField label="TIN No."        name="tin_no"        value={form.tin_no}        onChange={handleChange} placeholder="XXX-XXX-XXX" />
              <EditField label="SSS No."        name="sss_no"        value={form.sss_no}        onChange={handleChange} />
              <EditField label="GSIS No."       name="gsis_no"       value={form.gsis_no}       onChange={handleChange} />
              <EditField label="PhilHealth No." name="philhealth_no" value={form.philhealth_no} onChange={handleChange} />
              <EditField label="Pag-IBIG No."   name="pagibig_no"    value={form.pagibig_no}    onChange={handleChange} />
            </Section>
          ) : (
            <Section title="Government-Issued IDs">
              <ReadField label="TIN No."        value={form.tin_no} />
              <ReadField label="SSS No."        value={form.sss_no} />
              <ReadField label="GSIS No."       value={form.gsis_no} />
              <ReadField label="PhilHealth No." value={form.philhealth_no} />
              <ReadField label="Pag-IBIG No."   value={form.pagibig_no} />
            </Section>
          ))}

          {/* ━━━ OTHER ━━━ */}
          {activeTab === "other" && (editing ? (
            <>
              <Section title="Remarks / Notes">
                <EditTextarea label="Remarks" name="remarks" value={form.remarks} onChange={handleChange} wide />
              </Section>
              <Section title="System Info (Read-only)">
                <div className="em-field">
                  <span className="em-field__label">Created At</span>
                  <span className="em-field__value em-field__value--muted">{fmt(form.created_at) ?? "—"}</span>
                </div>
                <div className="em-field">
                  <span className="em-field__label">Last Updated</span>
                  <span className="em-field__value em-field__value--muted">{fmt(form.updated_at) ?? "—"}</span>
                </div>
              </Section>
            </>
          ) : (
            <>
              <Section title="Remarks / Notes">
                <ReadField label="Remarks" value={form.remarks} wide />
              </Section>
              <Section title="System Info">
                <ReadField label="Created At"   value={fmt(form.created_at)} />
                <ReadField label="Last Updated" value={fmt(form.updated_at)} />
              </Section>
            </>
          ))}

        </div>

        {/* ── Footer (only in edit mode) ── */}
        {editing && (
          <div className="em-footer">
            <button className="em-btn em-btn--cancel-lg" onClick={handleDiscard}>
              Discard Changes
            </button>
            <button className="em-btn em-btn--save-lg" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "💾 Save Changes"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
