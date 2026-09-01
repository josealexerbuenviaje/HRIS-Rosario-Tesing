import React, { useState, useEffect, useCallback } from "react";
import { authFetch } from "../auth";
import { useConfirm } from "./useConfirm";
import { useToast } from "./useToast";
import "../css_components/ContentArea.css";
import TableSkeleton from "./TableSkeleton";

function TrainingContentArea() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState("courses");

  // Employees Dropdown
  const [employees, setEmployees] = useState([]);

  // Lists
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [certifications, setCertifications] = useState([]);

  // Loading states
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");

  // Course Form
  const [courseForm, setCourseForm] = useState({
    title: "",
    description: "",
    category: "",
    duration_hours: "",
  });

  // Session Form
  const [sessionForm, setSessionForm] = useState({
    course_id: "",
    session_date: "",
    location: "",
    trainer: "",
    capacity: "",
  });

  // Enrollment Form
  const [enrollmentForm, setEnrollmentForm] = useState({
    employee_id: "",
    session_id: "",
  });

  // Certification Form
  const [certificationForm, setCertificationForm] = useState({
    employee_id: "",
    certification_name: "",
    issuing_body: "",
    issued_date: "",
    expiry_date: "",
  });

  // Report Form
  const [reportType, setReportType] = useState("course_completion");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const {confirm, ConfirmDialog} = useConfirm();

  // ─────────────────────────────────────────────────────────────
  // Load Employees
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    authFetch(`training_api.php?action=get_employees`)
      .then((res) => res.json())
      .then((json) => {
        if (json.status === "success") setEmployees(json.data || []);
      })
      .catch(console.error);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Load Courses
  // ─────────────────────────────────────────────────────────────
  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ action: "get_courses", search });
      const json = await authFetch(`training_api.php?${p}`).then((r) => r.json());
      if (json.status === "success") setCourses(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // ─────────────────────────────────────────────────────────────
  // Load Sessions
  // ─────────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ action: "get_sessions", search });
      const json = await authFetch(`training_api.php?${p}`).then((r) => r.json());
      if (json.status === "success") setSessions(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // ─────────────────────────────────────────────────────────────
  // Load Enrollments
  // ─────────────────────────────────────────────────────────────
  const loadEnrollments = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ action: "get_enrollments", search });
      const json = await authFetch(`training_api.php?${p}`).then((r) => r.json());
      if (json.status === "success") setEnrollments(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // ─────────────────────────────────────────────────────────────
  // Load Certifications
  // ─────────────────────────────────────────────────────────────
  const loadCertifications = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ action: "get_certifications", search });
      const json = await authFetch(`training_api.php?${p}`).then((r) => r.json());
      if (json.status === "success") setCertifications(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // ─────────────────────────────────────────────────────────────
  // Auto load depending on active tab
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === "courses") loadCourses();
    if (activeTab === "sessions") loadSessions();
    if (activeTab === "enrollments") loadEnrollments();
    if (activeTab === "certifications") loadCertifications();
  }, [activeTab, loadCourses, loadSessions, loadEnrollments, loadCertifications]);

  // ─────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────
  const handleCourseChange = (e) => {
    const { name, value } = e.target;
    setCourseForm((p) => ({ ...p, [name]: value }));
  };

  const handleSessionChange = (e) => {
    const { name, value } = e.target;
    setSessionForm((p) => ({ ...p, [name]: value }));
  };

  const handleEnrollmentChange = (e) => {
    const { name, value } = e.target;
    setEnrollmentForm((p) => ({ ...p, [name]: value }));
  };

  const handleCertificationChange = (e) => {
    const { name, value } = e.target;
    setCertificationForm((p) => ({ ...p, [name]: value }));
  };

  // ─────────────────────────────────────────────────────────────
  // Submit Course
  // ─────────────────────────────────────────────────────────────
  const submitCourse = async (e) => {
    e.preventDefault();
    try {
      const res  = await authFetch(`training_api.php?action=add_course`, {
        method: "POST",
        body: JSON.stringify(courseForm),
      });
      const json = await res.json();
      if (json.status === "success") {
        showToast("Course added", "success", json.message);
        setCourseForm({ title: "", description: "", category: "", duration_hours: "" });
        loadCourses();
      } else {
        showToast("Could not add course", "error", json.message);
      }
    } catch {
      showToast("Could not reach server", "error");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Submit Session
  // ─────────────────────────────────────────────────────────────
  const submitSession = async (e) => {
    e.preventDefault();
    try {
      const res  = await authFetch(`training_api.php?action=add_session`, {
        method: "POST",
        body: JSON.stringify(sessionForm),
      });
      const json = await res.json();
      if (json.status === "success") {
        showToast("Session scheduled", "success", json.message);
        setSessionForm({ course_id: "", session_date: "", location: "", trainer: "", capacity: "" });
        loadSessions();
      } else {
        showToast("Could not schedule session", "error", json.message);
      }
    } catch {
      showToast("Could not reach server", "error");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Submit Enrollment
  // ─────────────────────────────────────────────────────────────
  const submitEnrollment = async (e) => {
    e.preventDefault();
    try {
      const res  = await authFetch(`training_api.php?action=add_enrollment`, {
        method: "POST",
        body: JSON.stringify(enrollmentForm),
      });
      const json = await res.json();
      if (json.status === "success") {
        showToast("Employee enrolled", "success", json.message);
        setEnrollmentForm({ employee_id: "", session_id: "" });
        loadEnrollments();
      } else {
        showToast("Could not enroll employee", "error", json.message);
      }
    } catch {
      showToast("Could not reach server", "error");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Update Enrollment Status
  // ─────────────────────────────────────────────────────────────
  const updateEnrollmentStatus = async (enrollment_id, status) => {
    try {
      const res  = await authFetch(`training_api.php?action=update_enrollment_status`, {
        method: "POST",
        body: JSON.stringify({ enrollment_id, status }),
      });
      const json = await res.json();
      if (json.status === "success") {
        showToast("Enrollment status updated", "success", json.message);
        loadEnrollments();
      } else {
        showToast("Could not update enrollment status", "error", json.message);
      }
    } catch {
      showToast("Could not reach server", "error");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Submit Certification
  // ─────────────────────────────────────────────────────────────
  const submitCertification = async (e) => {
    e.preventDefault();
    try {
      const res  = await authFetch(`training_api.php?action=add_certification`, {
        method: "POST",
        body: JSON.stringify(certificationForm),
      });
      const json = await res.json();
      if (json.status === "success") {
        showToast("Certification added", "success", json.message);
        setCertificationForm({
          employee_id: "",
          certification_name: "",
          issuing_body: "",
          issued_date: "",
          expiry_date: "",
        });
        loadCertifications();
      } else {
        showToast("Could not add certification", "error", json.message);
      }
    } catch {
      showToast("Could not reach server", "error");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Delete Functions
  // ─────────────────────────────────────────────────────────────
  const deleteItem = async (type, idField, idValue) => {
    const ok = await confirm("Are you sure you want to delete this record?");
    if (!ok) return;
    try {
      const res  = await authFetch(`training_api.php?action=delete_${type}`, {
        method: "POST",
        body: JSON.stringify({ [idField]: idValue }),
      });
      const json = await res.json();
      if (json.status === "success") {
        showToast("Record deleted", "success", json.message);
        if (type === "course")        loadCourses();
        if (type === "session")       loadSessions();
        if (type === "enrollment")    loadEnrollments();
        if (type === "certification") loadCertifications();
      } else {
        showToast("Could not delete record", "error", json.message);
      }
    } catch {
      showToast("Could not reach server", "error");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Generate Report CSV
  // ─────────────────────────────────────────────────────────────
  const generateReport = async () => {
    try {
      const p   = new URLSearchParams({
        action: "generate_report",
        type:   reportType,
        from:   fromDate,
        to:     toDate,
        format: "csv",
      });
      const res = await authFetch(`training_api.php?${p}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `training_${reportType}_${fromDate}_to_${toDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast("Report downloaded", "success");
    } catch {
      showToast("Failed to generate report", "error");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Render Tabs
  // ─────────────────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case "courses":
        return (
          <div className="tab-content">
            <h2>Courses</h2>
            <p>Create and manage training courses.</p>

            <form onSubmit={submitCourse} className="training-form">
              <label>Title *</label>
              <input
                type="text"
                name="title"
                value={courseForm.title}
                onChange={handleCourseChange}
                required
              />

              <label>Category</label>
              <input
                type="text"
                name="category"
                value={courseForm.category}
                onChange={handleCourseChange}
                placeholder="e.g. Compliance, Technical, Soft Skills"
              />

              <label>Duration (hours)</label>
              <input
                type="number"
                name="duration_hours"
                value={courseForm.duration_hours}
                onChange={handleCourseChange}
                min="0"
              />

              <label>Description</label>
              <textarea
                name="description"
                value={courseForm.description}
                onChange={handleCourseChange}
                placeholder="Course overview..."
              />

              <button type="submit">Add Course</button>
              <button
                type="button"
                onClick={() =>
                  setCourseForm({ title: "", description: "", category: "", duration_hours: "" })
                }
              >
                Cancel
              </button>
            </form>

            <div className="filters">
              <input
                type="text"
                placeholder="Search courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="button" className="btn" onClick={loadCourses}>
                Search
              </button>
            </div>

            <h3>Available Courses</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Duration (hrs)</th>
                  <th>Description</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton columns={5} rows={5} />
                ) : courses.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: 20 }}>No courses found.</td>
                  </tr>
                ) : (
                  courses.map((c) => (
                    <tr key={c.course_id}>
                      <td>{c.title}</td>
                      <td>{c.category || "—"}</td>
                      <td>{c.duration_hours || "—"}</td>
                      <td>{c.description || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn-sm btn-sm--delete"
                          onClick={() => deleteItem("course", "course_id", c.course_id)}
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

      case "sessions":
        return (
          <div className="tab-content">
            <h2>Sessions</h2>
            <p>Schedule training sessions for existing courses.</p>

            <form className="training-form" onSubmit={submitSession}>
              <label>Course *</label>
              <select
                name="course_id"
                value={sessionForm.course_id}
                onChange={handleSessionChange}
                required
              >
                <option value="">Select Course</option>
                {courses.map((c) => (
                  <option key={c.course_id} value={c.course_id}>
                    {c.title}
                  </option>
                ))}
              </select>

              <label>Session Date *</label>
              <input
                type="date"
                name="session_date"
                value={sessionForm.session_date}
                onChange={handleSessionChange}
                required
              />

              <label>Trainer</label>
              <input
                type="text"
                name="trainer"
                value={sessionForm.trainer}
                onChange={handleSessionChange}
              />

              <label>Location</label>
              <input
                type="text"
                name="location"
                value={sessionForm.location}
                onChange={handleSessionChange}
              />

              <label>Capacity</label>
              <input
                type="number"
                name="capacity"
                value={sessionForm.capacity}
                onChange={handleSessionChange}
                min="0"
              />

              <button type="submit" className="btn">Schedule Session</button>
            </form>

            <div className="filters">
              <input
                type="text"
                placeholder="Search sessions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="button" className="btn" onClick={loadSessions}>Search</button>
            </div>

            <h3>Upcoming Sessions</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Date</th>
                  <th>Trainer</th>
                  <th>Location</th>
                  <th>Capacity</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                    <TableSkeleton columns={6} rows={5} />
                  ) : sessions.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: 20 }}>No sessions found.</td>
                    </tr>
                  ) : (
                    sessions.map((s) => (
                    <tr key={s.session_id}>
                      <td>{s.course_title}</td>
                      <td>{s.session_date}</td>
                      <td>{s.trainer || "—"}</td>
                      <td>{s.location || "—"}</td>
                      <td>{s.capacity || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn-sm btn-sm--delete"
                          onClick={() => deleteItem("session", "session_id", s.session_id)}
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

      case "enrollments":
        return (
          <div className="tab-content">
            <h2>Enrollments</h2>
            <p>Enroll employees into scheduled training sessions.</p>

            <form className="training-form" onSubmit={submitEnrollment}>
              <label>Employee *</label>
              <select
                name="employee_id"
                value={enrollmentForm.employee_id}
                onChange={handleEnrollmentChange}
                required
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>

              <label>Session *</label>
              <select
                name="session_id"
                value={enrollmentForm.session_id}
                onChange={handleEnrollmentChange}
                required
              >
                <option value="">Select Session</option>
                {sessions.map((s) => (
                  <option key={s.session_id} value={s.session_id}>
                    {s.course_title} — {s.session_date}
                  </option>
                ))}
              </select>

              <button type="submit">Enroll</button>
            </form>

            <div className="filters">
              <input
                type="text"
                placeholder="Search enrollments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="button" className="btn" onClick={loadEnrollments}>Search</button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Course</th>
                  <th>Session Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                  {loading ? (
                      <TableSkeleton columns={5} rows={5} />
                    ) : enrollments.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: "center", padding: 20 }}>No enrollments found.</td>
                      </tr>
                    ) : (
                      enrollments.map((en) => (
                    <tr key={en.enrollment_id}>
                      <td>{en.employee_name}</td>
                      <td>{en.course_title}</td>
                      <td>{en.session_date}</td>
                      <td>
                        <select
                          value={en.status}
                          onChange={(e) => updateEnrollmentStatus(en.enrollment_id, e.target.value)}
                        >
                          <option>Enrolled</option>
                          <option>In Progress</option>
                          <option>Completed</option>
                          <option>Cancelled</option>
                        </select>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn-sm btn-sm--delete"
                          onClick={() => deleteItem("enrollment", "enrollment_id", en.enrollment_id)}
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

      case "certifications":
        return (
          <div className="tab-content">
            <h2>Certifications</h2>
            <p>Track employee certifications earned through training.</p>

            <form className="training-form" onSubmit={submitCertification}>
              <label>Employee *</label>
              <select
                name="employee_id"
                value={certificationForm.employee_id}
                onChange={handleCertificationChange}
                required
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>

              <label>Certification Name *</label>
              <input
                type="text"
                name="certification_name"
                value={certificationForm.certification_name}
                onChange={handleCertificationChange}
                required
              />

              <label>Issuing Body</label>
              <input
                type="text"
                name="issuing_body"
                value={certificationForm.issuing_body}
                onChange={handleCertificationChange}
              />

              <label>Issued Date</label>
              <input
                type="date"
                name="issued_date"
                value={certificationForm.issued_date}
                onChange={handleCertificationChange}
              />

              <label>Expiry Date</label>
              <input
                type="date"
                name="expiry_date"
                value={certificationForm.expiry_date}
                onChange={handleCertificationChange}
              />

              <button type="submit">Add Certification</button>
            </form>

            <div className="filters">
              <input
                type="text"
                placeholder="Search certifications..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="button" className="btn" onClick={loadCertifications}>Search</button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Certification</th>
                  <th>Issuing Body</th>
                  <th>Issued</th>
                  <th>Expires</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                  {loading ? (
                      <TableSkeleton columns={6} rows={5} />
                    ) : certifications.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: "center", padding: 20 }}>No certifications found.</td>
                      </tr>
                    ) : (
                      certifications.map((cert) => (
                    <tr key={cert.certification_id}>
                      <td>{cert.employee_name}</td>
                      <td>{cert.certification_name}</td>
                      <td>{cert.issuing_body || "—"}</td>
                      <td>{cert.issued_date || "—"}</td>
                      <td>{cert.expiry_date || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn-sm btn-sm--delete"
                          onClick={() => deleteItem("certification", "certification_id", cert.certification_id)}
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

      case "reports":
        return (
          <div className="tab-content">
            <h2>Reports</h2>
            <p>Generate training reports (CSV download).</p>

            <form className="training-form" onSubmit={(e) => e.preventDefault()}>
              <label>Report Type</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
                <option value="course_completion">Course Completion</option>
                <option value="certification_status">Certification Status</option>
              </select>

              <label>Start Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />

              <label>End Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />

              <button type="button" onClick={generateReport}>Generate Report</button>
            </form>
          </div>
        );

      default:
        return <div>Select a tab.</div>;
    }
  };

  return (
    <div className="content-area">
      <nav className="tabs" role="tablist">
        <button className={activeTab === "courses" ? "active" : ""} onClick={() => setActiveTab("courses")}>
          Courses
        </button>
        <button className={activeTab === "sessions" ? "active" : ""} onClick={() => setActiveTab("sessions")}>
          Sessions
        </button>
        <button className={activeTab === "enrollments" ? "active" : ""} onClick={() => setActiveTab("enrollments")}>
          Enrollments
        </button>
        <button className={activeTab === "certifications" ? "active" : ""} onClick={() => setActiveTab("certifications")}>
          Certifications
        </button>
        <button className={activeTab === "reports" ? "active" : ""} onClick={() => setActiveTab("reports")}>
          Reports
        </button>
      </nav>

      {renderContent()}
      {ConfirmDialog}
    </div>
  );
}

export default TrainingContentArea;