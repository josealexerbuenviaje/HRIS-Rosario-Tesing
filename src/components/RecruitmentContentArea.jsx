import React, { useState, useEffect, useCallback } from "react";
import { authFetch } from "../auth";
import { useConfirm } from "./useConfirm";
import { useToast } from "./useToast";
import TableSkeleton from "./TableSkeleton";
import "../css_components/ContentArea.css";


// ─────────────────────────────────────────────────────────────
// Shared UI Helpers
// ─────────────────────────────────────────────────────────────

// Safely parse JSON — returns null and logs if the server sent HTML/error page
async function safeJson(res) {
  if (!res) return null;
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error(
      `[API] Expected JSON but got (HTTP ${res.status}):`,
      text.slice(0, 200)
    );
    return null;
  }
}

function RecruitmentContentArea() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState("jobPostings");

  // Shared dropdown data
  const [jobPostings, setJobPostings]         = useState([]);
  const [applicants, setApplicants]           = useState([]);
  const [interviewResults, setInterviewResults] = useState([]);
  const [appointments, setAppointments]       = useState([]);
  const [checklist, setChecklist]             = useState([]);
  const [screeningList, setScreeningList]     = useState([]);

  // Loading
  const [loading, setLoading]   = useState(false);

  // Shared search
  const [search, setSearch] = useState("");

  // ── Job Posting Form ────────────────────────────────────────
  const [jobForm, setJobForm] = useState({
    title: "", department: "", description: "", requirements: "", status: "Open",
  });

  // ── Applicant Form ──────────────────────────────────────────
  const [applicantForm, setApplicantForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", job_posting_id: "",
  });

  // ── Interview Result Form ───────────────────────────────────
  const [resultForm, setResultForm] = useState({
    applicant_id: "", result: "Pass", notes: "", interviewed_at: "",
  });

  // ── Appointment Form ────────────────────────────────────────
  const [apptForm, setApptForm] = useState({
    applicant_id: "", type: "Interview", date: "", notes: "",
  });

  // ── Checklist selected applicant ───────────────────────────
  const [checklistApplicantId, setChecklistApplicantId] = useState("");

  // ── Report ──────────────────────────────────────────────────
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo,   setReportTo]   = useState("");

// ── Delete confirm window ──────────────────────────────────────────────────
  const { confirm, ConfirmDialog } = useConfirm();
  // ─────────────────────────────────────────────────────────────
  // Load employees/applicants for dropdowns
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    authFetch("applicants.php")
      .then((r) => safeJson(r))
      .then((j) => { if (j?.success) setApplicants(j.data || []); })
      .catch(console.error);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Loaders
  // ─────────────────────────────────────────────────────────────
  const loadJobPostings = useCallback(async () => {
    setLoading(true);
    try {
      const p    = new URLSearchParams({ search });
      const json = await authFetch(`job_postings.php?${p}`).then((r) => safeJson(r));
      if (json?.success) setJobPostings(json.data || []); else if (json) showToast("Failed to load job postings", "error", json.error);
    } catch (e) { showToast("Could not reach server", "error"); }
    finally { setLoading(false); }
  }, [search]);

  const loadApplicants = useCallback(async () => {
    setLoading(true);
    try {
      const p    = new URLSearchParams({ search });
      const json = await authFetch(`applicants.php?${p}`).then((r) => safeJson(r));
      if (json?.success) setApplicants(json.data || []); else if (json) showToast("Failed to load applicants", "error", json.error);
    } catch (e) { showToast("Could not reach server", "error"); }
    finally { setLoading(false); }
  }, [search]);

  const loadInterviewResults = useCallback(async () => {
    setLoading(true);
    try {
      const json = await authFetch("interview_results.php").then((r) => safeJson(r));
      if (json?.success) setInterviewResults(json.data || []); else if (json) showToast("Failed to load interview results", "error", json.error);
    } catch (e) { showToast("Could not reach server", "error"); }
    finally { setLoading(false); }
  }, []);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const json = await authFetch("appointments.php").then((r) => safeJson(r));
      if (json?.success) setAppointments(json.data || []); else if (json) showToast("Failed to load appointments", "error", json.error);
    } catch (e) { showToast("Could not reach server", "error"); }
    finally { setLoading(false); }
  }, []);

  const loadChecklist = useCallback(async (applicant_id) => {
    if (!applicant_id) { setChecklist([]); return; }
    try {
      const json = await authFetch(
        `appointments.php?action=checklist&applicant_id=${applicant_id}`
      ).then((r) => safeJson(r));
      if (json?.success) setChecklist(json.data || []);
    } catch (e) { showToast("Could not reach server", "error"); }
  }, []);

  const loadScreening = useCallback(async () => {
    setLoading(true);
    try {
      const p    = new URLSearchParams({ search });
      const json = await authFetch(`screening_report.php?${p}`).then((r) => safeJson(r));
      if (json?.success) setScreeningList(json.data || []); else if (json) showToast("Failed to load screening list", "error", json.error);
    } catch (e) { showToast("Could not reach server", "error"); }
    finally { setLoading(false); }
  }, [search]);

  // Auto-load on tab change
  useEffect(() => {
    if (activeTab === "jobPostings")        loadJobPostings();
    if (activeTab === "applicants")         loadApplicants();
    if (activeTab === "interviewResults")   loadInterviewResults();
    if (activeTab === "appointmentOnboarding") loadAppointments();
    if (activeTab === "screening")          loadScreening();
  }, [activeTab, loadJobPostings, loadApplicants, loadInterviewResults, loadAppointments, loadScreening]);

  // ─────────────────────────────────────────────────────────────
  // Submit: Job Posting
  // ─────────────────────────────────────────────────────────────
  const submitJobPosting = async (e) => {
    e.preventDefault();
    try {
      const res  = await authFetch("job_postings.php", {
        method: "POST",
        body:   JSON.stringify(jobForm),
      });
      const json = await safeJson(res);
      if (json?.success) {
        showToast("Job posted successfully", "success");
        setJobForm({ title: "", department: "", description: "", requirements: "", status: "Open" });
        loadJobPostings();
      } else {
        showToast("Failed to post job", "error", json?.error);
      }
    } catch {
      showToast("Could not reach server", "error");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Update Job Status (Open / Closed)
  // ─────────────────────────────────────────────────────────────
  const closeJobPosting = async (job) => {
    const ok = await confirm("Close this job posting?", { danger: false });
    if (!ok) return;
    try {
      const res  = await authFetch(`job_postings.php?id=${job.id}`, { method: "DELETE" });
      const json = await safeJson(res);
      if (json?.success) {
        showToast("Job posting closed", "success");
        loadJobPostings();
      } else {
        showToast("Failed to close posting", "error", json?.error);
      }
    } catch {
      showToast("Could not reach server", "error");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Submit: Applicant
  // ─────────────────────────────────────────────────────────────
  const submitApplicant = async (e) => {
    e.preventDefault();
    try {
      const res  = await authFetch("applicants.php", {
        method: "POST",
        body:   JSON.stringify(applicantForm),
      });
      const json = await safeJson(res);
      if (json?.success) {
        showToast("Applicant added", "success");
        setApplicantForm({ first_name: "", last_name: "", email: "", phone: "", job_posting_id: "" });
        loadApplicants();
      } else {
        showToast("Failed to add applicant", "error", json?.error);
      }
    } catch {
      showToast("Could not reach server", "error");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Update Applicant Status
  // ─────────────────────────────────────────────────────────────
  const updateApplicantStatus = async (id, status) => {
    try {
      const res  = await authFetch(`applicants.php?id=${id}`, {
        method: "PUT",
        body:   JSON.stringify({ status }),
      });
      const json = await safeJson(res);
      if (json?.success) {
        showToast("Status updated", "success");
        loadApplicants();
      } else {
        showToast("Failed to update status", "error", json?.error);
      }
    } catch {
      showToast("Could not reach server", "error");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Submit: Interview Result
  // ─────────────────────────────────────────────────────────────
  const submitResult = async (e) => {
    e.preventDefault();
    try {
      const res  = await authFetch("interview_results.php", {
        method: "POST",
        body:   JSON.stringify(resultForm),
      });
      const json = await safeJson(res);
      if (json?.success) {
        showToast("Interview result recorded", "success");
        setResultForm({ applicant_id: "", result: "Pass", notes: "", interviewed_at: "" });
        loadInterviewResults();
      } else {
        showToast("Failed to save result", "error", json?.error);
      }
    } catch {
      showToast("Could not reach server", "error");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Submit: Appointment
  // ─────────────────────────────────────────────────────────────
  const submitAppointment = async (e) => {
    e.preventDefault();
    try {
      const res  = await authFetch("appointments.php", {
        method: "POST",
        body:   JSON.stringify(apptForm),
      });
      const json = await safeJson(res);
      if (json?.success) {
        showToast("Appointment scheduled", "success");
        setApptForm({ applicant_id: "", type: "Interview", date: "", notes: "" });
        loadAppointments();
      } else {
        showToast("Failed to schedule appointment", "error", json?.error);
      }
    } catch {
      showToast("Could not reach server", "error");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Toggle Checklist Item
  // ─────────────────────────────────────────────────────────────
  const toggleChecklist = async (item) => {
    try {
      await authFetch("appointments.php?action=checklist", {
        method: "POST",
        body: JSON.stringify({
          applicant_id:      parseInt(checklistApplicantId),
          checklist_item_id: item.id,
          is_done:           item.is_done ? 0 : 1,
        }),
      });
      loadChecklist(checklistApplicantId);
    } catch (e) { showToast("Could not reach server", "error"); }
  };

  // ─────────────────────────────────────────────────────────────
  // Delete helpers
  // ─────────────────────────────────────────────────────────────
  const deleteItem = async (endpoint, id, reload) => {
    const ok = await confirm("Are you sure you want to delete this record?");
    if (!ok) return;
    try {
      const res  = await authFetch(`${endpoint}.php?id=${id}`, { method: "DELETE" });
      const json = await safeJson(res);
      if (json?.success) {
        showToast(json.message || "Deleted", "success");
        reload();
      } else {
        showToast("Delete failed", "error", json?.error);
      }
    } catch {
      showToast("Could not reach server", "error");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Screening actions
  // ─────────────────────────────────────────────────────────────
  const screeningAction = async (id, status) => {
    try {
      const res  = await authFetch(`applicants.php?id=${id}`, {
        method: "PUT",
        body:   JSON.stringify({ status }),
      });
      const json = await safeJson(res);
      if (json?.success) {
        showToast(`Applicant moved to ${status}`, "success");
        loadScreening();
      } else {
        showToast("Action failed", "error", json?.error);
      }
    } catch {
      showToast("Could not reach server", "error");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Export CSV
  // ─────────────────────────────────────────────────────────────
  const exportScreeningCSV = async () => {
    try {
      const p   = new URLSearchParams({ export: "csv", search });
      const res = await authFetch(`screening_report.php?${p}`);
      if (!res || !res.ok) {
        showToast("Failed to export CSV", "error");
        return;
      }
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `screening_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast("CSV downloaded", "success");
    } catch {
      showToast("Could not reach server", "error");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Render Tabs
  // ─────────────────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {

      // ── Job Postings ─────────────────────────────────────────
      case "jobPostings":
        return (
          <div className="tab-content">
            <h2>Job Postings</h2>
            <p>Manage job openings. Post new positions and track status.</p>

            <form onSubmit={submitJobPosting} className="job-form">
              <label>Job Title *</label>
              <input
                type="text"
                name="title"
                value={jobForm.title}
                onChange={(e) => setJobForm((p) => ({ ...p, title: e.target.value }))}
                required
              />

              <label>Department *</label>
              <input
                type="text"
                name="department"
                value={jobForm.department}
                onChange={(e) => setJobForm((p) => ({ ...p, department: e.target.value }))}
                required
              />

              <label>Status</label>
              <select
                name="status"
                value={jobForm.status}
                onChange={(e) => setJobForm((p) => ({ ...p, status: e.target.value }))}
              >
                <option>Open</option>
                <option>Draft</option>
              </select>

              <label>Description</label>
              <textarea
                name="description"
                value={jobForm.description}
                onChange={(e) => setJobForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Job description..."
              />

              <label>Requirements</label>
              <textarea
                name="requirements"
                value={jobForm.requirements}
                onChange={(e) => setJobForm((p) => ({ ...p, requirements: e.target.value }))}
                placeholder="Key requirements..."
              />

              <button type="submit">Post Job</button>
              <button
                type="button"
                onClick={() => setJobForm({ title: "", department: "", description: "", requirements: "", status: "Open" })}
              >
                Cancel
              </button>
            </form>

            <div className="filters">
              <input
                type="text"
                placeholder="Search job postings..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="button" className="btn" onClick={loadJobPostings}>Search</button>
            </div>

            <h3>Current Postings</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Applicants</th>
                  <th>Posted By</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton columns={6} rows={5} />
                ) : jobPostings.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: 20 }}>No job postings found.</td></tr>
                ) : (
                  jobPostings.map((job) => (
                    <tr key={job.id}>
                      <td>{job.title}</td>
                      <td>{job.department}</td>
                      <td>{job.status}</td>
                      <td style={{ textAlign: "center" }}>{job.applicant_count ?? 0}</td>
                      <td>{job.posted_by || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        {job.status !== "Closed" && (
                          <button
                            className="btn-sm btn-sm--delete"
                            onClick={() => closeJobPosting(job)}
                          >
                            Close
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );

      // ── Appointment / Onboarding ─────────────────────────────
      case "appointmentOnboarding":
        return (
          <div className="tab-content">
            <h2>Appointment / Onboarding</h2>
            <p>Schedule appointments and manage onboarding checklists.</p>

            <form className="appointment-form" onSubmit={submitAppointment}>
              <label>Applicant *</label>
              <select
                name="applicant_id"
                value={apptForm.applicant_id}
                onChange={(e) => setApptForm((p) => ({ ...p, applicant_id: e.target.value }))}
                required
              >
                <option value="">Select Applicant</option>
                {applicants.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>

              <label>Appointment Date *</label>
              <input
                type="date"
                name="date"
                value={apptForm.date}
                onChange={(e) => setApptForm((p) => ({ ...p, date: e.target.value }))}
                required
              />

              <label>Type</label>
              <select
                name="type"
                value={apptForm.type}
                onChange={(e) => setApptForm((p) => ({ ...p, type: e.target.value }))}
              >
                <option>Interview</option>
                <option>Onboarding</option>
              </select>

              <label>Notes</label>
              <input
                type="text"
                name="notes"
                value={apptForm.notes}
                onChange={(e) => setApptForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes..."
              />

              <button type="submit">Schedule</button>
              <button
                type="button"
                onClick={() => setApptForm({ applicant_id: "", type: "Interview", date: "", notes: "" })}
              >
                Cancel
              </button>
            </form>

            <h3>Scheduled Appointments</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Position</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Scheduled By</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton columns={6} rows={5} />
                ) : appointments.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: 20 }}>No appointments scheduled.</td></tr>
                ) : (
                  appointments.map((a) => (
                    <tr key={a.id}>
                      <td>{a.applicant}</td>
                      <td>{a.position || "—"}</td>
                      <td>{a.type}</td>
                      <td>{a.appointment_date}</td>
                      <td>{a.scheduled_by || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn-sm btn-sm--delete"
                          onClick={() => deleteItem("appointments", a.id, loadAppointments)}
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <h3>Onboarding Checklist</h3>
            <div className="filters">
              <select
                value={checklistApplicantId}
                onChange={(e) => {
                  setChecklistApplicantId(e.target.value);
                  loadChecklist(e.target.value);
                }}
              >
                <option value="">Select applicant to view checklist...</option>
                {applicants.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {checklist.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0, margin: "0.75rem 0" }}>
                {checklist.map((item) => (
                  <li
                    key={item.id}
                    onClick={() => toggleChecklist(item)}
                    style={{ cursor: "pointer", padding: "7px 0", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span style={{ fontSize: "1.1rem" }}>{item.is_done ? "✅" : "⬜"}</span>
                    <span style={{ textDecoration: item.is_done ? "line-through" : "none", color: item.is_done ? "#9ca3af" : "#111827" }}>
                      {item.label}
                    </span>
                    {item.completed_at && (
                      <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#9ca3af" }}>
                        {item.completed_at.slice(0, 10)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );

      // ── Applicants ───────────────────────────────────────────
      case "applicants":
        return (
          <div className="tab-content">
            <h2>Applicants</h2>
            <p>View and manage applicant profiles.</p>

            <form className="applicant-form" onSubmit={submitApplicant}>
              <label>First Name *</label>
              <input
                type="text"
                name="first_name"
                value={applicantForm.first_name}
                onChange={(e) => setApplicantForm((p) => ({ ...p, first_name: e.target.value }))}
                required
              />

              <label>Last Name *</label>
              <input
                type="text"
                name="last_name"
                value={applicantForm.last_name}
                onChange={(e) => setApplicantForm((p) => ({ ...p, last_name: e.target.value }))}
                required
              />

              <label>Email *</label>
              <input
                type="email"
                name="email"
                value={applicantForm.email}
                onChange={(e) => setApplicantForm((p) => ({ ...p, email: e.target.value }))}
                required
              />

              <label>Phone</label>
              <input
                type="text"
                name="phone"
                value={applicantForm.phone}
                onChange={(e) => setApplicantForm((p) => ({ ...p, phone: e.target.value }))}
              />

              <label>Job Posting</label>
              <select
                name="job_posting_id"
                value={applicantForm.job_posting_id}
                onChange={(e) => setApplicantForm((p) => ({ ...p, job_posting_id: e.target.value }))}
              >
                <option value="">Select Job Posting</option>
                {jobPostings.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>

              <button type="submit">Add Applicant</button>
              <button
                type="button"
                onClick={() => setApplicantForm({ first_name: "", last_name: "", email: "", phone: "", job_posting_id: "" })}
              >
                Cancel
              </button>
            </form>

            <div className="filters">
              <input
                type="text"
                placeholder="Search applicants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="button" className="btn" onClick={loadApplicants}>Search</button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Position</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton columns={5} rows={5} />
                ) : applicants.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 20 }}>No applicants found.</td></tr>
                ) : (
                  applicants.map((app) => (
                    <tr key={app.id}>
                      <td>{app.name}</td>
                      <td>{app.email}</td>
                      <td>{app.position || "—"}</td>
                      <td>
                        <select
                          value={app.status}
                          onChange={(e) => updateApplicantStatus(app.id, e.target.value)}
                        >
                          {["Pending", "Screening", "Interviewed", "Offered", "Hired", "Rejected"].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn-sm btn-sm--delete"
                          onClick={() => deleteItem("applicants", app.id, loadApplicants)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );

      // ── Interview Results ────────────────────────────────────
      case "interviewResults":
        return (
          <div className="tab-content">
            <h2>Interview Results</h2>
            <p>Review interview outcomes and feedback.</p>

            <form className="result-form" onSubmit={submitResult}>
              <label>Applicant *</label>
              <select
                name="applicant_id"
                value={resultForm.applicant_id}
                onChange={(e) => setResultForm((p) => ({ ...p, applicant_id: e.target.value }))}
                required
              >
                <option value="">Select Applicant</option>
                {applicants.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>

              <label>Result *</label>
              <select
                name="result"
                value={resultForm.result}
                onChange={(e) => setResultForm((p) => ({ ...p, result: e.target.value }))}
              >
                <option>Pass</option>
                <option>Fail</option>
                <option>Hold</option>
              </select>

              <label>Interview Date &amp; Time</label>
              <input
                type="datetime-local"
                name="interviewed_at"
                value={resultForm.interviewed_at}
                onChange={(e) => setResultForm((p) => ({ ...p, interviewed_at: e.target.value }))}
              />

              <label>Notes</label>
              <textarea
                name="notes"
                value={resultForm.notes}
                onChange={(e) => setResultForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Feedback and observations..."
              />

              <button type="submit">Save Result</button>
              <button
                type="button"
                onClick={() => setResultForm({ applicant_id: "", result: "Pass", notes: "", interviewed_at: "" })}
              >
                Cancel
              </button>
            </form>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Position</th>
                  <th>Result</th>
                  <th>Interviewer</th>
                  <th>Date</th>
                  <th>Notes</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton columns={7} rows={5} />
                ) : interviewResults.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: 20 }}>No results found.</td></tr>
                ) : (
                  interviewResults.map((r) => (
                    <tr key={r.id}>
                      <td>{r.applicant}</td>
                      <td>{r.position || "—"}</td>
                      <td>{r.result}</td>
                      <td>{r.interviewer || "—"}</td>
                      <td>{r.interviewed_at?.slice(0, 10)}</td>
                      <td>{r.notes || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn-sm btn-sm--delete"
                          onClick={() => deleteItem("interview_results", r.id, loadInterviewResults)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );

      // ── Screening ────────────────────────────────────────────
      case "screening":
        return (
          <div className="tab-content">
            <h2>Screening</h2>
            <p>Conduct initial screening of applicants.</p>

            <div className="filters">
              <input
                type="text"
                placeholder="Search by name or position..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="button" className="btn" onClick={loadScreening}>Search</button>
              <button type="button" className="btn" onClick={exportScreeningCSV}>Export CSV</button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Position</th>
                  <th>Department</th>
                  <th>Applied</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton columns={6} rows={5} />
                ) : screeningList.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: 20 }}>No applicants in screening.</td></tr>
                ) : (
                  screeningList.map((app) => (
                    <tr key={app.id}>
                      <td>{app.name}</td>
                      <td>{app.email}</td>
                      <td>{app.position || "—"}</td>
                      <td>{app.department || "—"}</td>
                      <td>{app.applied_at?.slice(0, 10)}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn-sm"
                          style={{ marginRight: 6 }}
                          onClick={() => screeningAction(app.id, "Interviewed")}
                        >
                          Move to Interview
                        </button>
                        <button
                          className="btn-sm btn-sm--delete"
                          onClick={() => screeningAction(app.id, "Rejected")}
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );

      default:
        return <div>Select a tab to view content.</div>;
    }
  };

  return (
    <div className="content-area">
      <nav className="tabs" role="tablist">
        <button
          className={activeTab === "jobPostings" ? "active" : ""}
          onClick={() => setActiveTab("jobPostings")}
          role="tab"
        >
          Job Postings
        </button>
        <button
          className={activeTab === "appointmentOnboarding" ? "active" : ""}
          onClick={() => setActiveTab("appointmentOnboarding")}
          role="tab"
        >
          Appointment/Onboarding
        </button>
        <button
          className={activeTab === "applicants" ? "active" : ""}
          onClick={() => setActiveTab("applicants")}
          role="tab"
        >
          Applicants
        </button>
        <button
          className={activeTab === "interviewResults" ? "active" : ""}
          onClick={() => setActiveTab("interviewResults")}
          role="tab"
        >
          Interview Results
        </button>
        <button
          className={activeTab === "screening" ? "active" : ""}
          onClick={() => setActiveTab("screening")}
          role="tab"
        >
          Screening
        </button>
      </nav>

      {renderContent()}
      {ConfirmDialog}
    </div>
  );
}

export default RecruitmentContentArea;