import React, { useState, useEffect, useCallback } from "react";
import { authFetch } from "../auth";
import "./css_components/ContentArea.css";

// ─────────────────────────────────────────────────────────────
// Shared UI Helpers
// ─────────────────────────────────────────────────────────────
const ApiMsg = ({ msg }) =>
  msg ? <div className={`api-msg api-msg--${msg.type}`}>{msg.text}</div> : null;

function PerformanceContentArea() {
  const [activeTab, setActiveTab] = useState("evaluations");

  // Employees Dropdown
  const [employees, setEmployees] = useState([]);

  // Lists
  const [evaluations, setEvaluations] = useState([]);
  const [goals, setGoals] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);

  // Loading states
  const [loading, setLoading] = useState(false);

  // Messages
  const [apiMsg, setApiMsg] = useState(null);

  // Filters
  const [search, setSearch] = useState("");

  // Evaluation Form
  const [evaluationForm, setEvaluationForm] = useState({
    employee_id: "",
    rating: "",
    comments: "",
  });

  // Goal Form
  const [goalForm, setGoalForm] = useState({
    employee_id: "",
    goal_description: "",
    deadline: "",
  });

  // Review Form
  const [reviewForm, setReviewForm] = useState({
    employee_id: "",
    review_text: "",
    reviewer: "",
  });

  // Feedback Form
  const [feedbackForm, setFeedbackForm] = useState({
    employee_id: "",
    feedback_text: "",
    submitted_by: "",
  });

  // Report Form
  const [reportType, setReportType] = useState("evaluation_summary");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // ─────────────────────────────────────────────────────────────
  // Load Employees
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    authFetch(`performance_api.php?action=get_employees`)
      .then((res) => res.json())
      .then((json) => {
        if (json.status === "success") setEmployees(json.data || []);
      })
      .catch(console.error);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Load Evaluations
  // ─────────────────────────────────────────────────────────────
  const loadEvaluations = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ action: "get_evaluations", search });
      const json = await authFetch(`performance_api.php?${p}`).then((r) => r.json());
      if (json.status === "success") setEvaluations(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // ─────────────────────────────────────────────────────────────
  // Load Goals
  // ─────────────────────────────────────────────────────────────
  const loadGoals = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ action: "get_goals", search, status: "All" });
      const json = await authFetch(`performance_api.php?${p}`).then((r) => r.json());
      if (json.status === "success") setGoals(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // ─────────────────────────────────────────────────────────────
  // Load Reviews
  // ─────────────────────────────────────────────────────────────
  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ action: "get_reviews", search });
      const json = await authFetch(`performance_api.php?${p}`).then((r) => r.json());
      if (json.status === "success") setReviews(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // ─────────────────────────────────────────────────────────────
  // Load Feedback
  // ─────────────────────────────────────────────────────────────
  const loadFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ action: "get_feedback", search });
      const json = await authFetch(`performance_api.php?${p}`).then((r) => r.json());
      if (json.status === "success") setFeedbacks(json.data || []);
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
    setApiMsg(null);
    if (activeTab === "evaluations") loadEvaluations();
    if (activeTab === "goals") loadGoals();
    if (activeTab === "reviews") loadReviews();
    if (activeTab === "feedback") loadFeedback();
  }, [activeTab, loadEvaluations, loadGoals, loadReviews, loadFeedback]);

  // ─────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────
  const handleEvaluationChange = (e) => {
    const { name, value } = e.target;
    setEvaluationForm((p) => ({ ...p, [name]: value }));
  };

  const handleGoalChange = (e) => {
    const { name, value } = e.target;
    setGoalForm((p) => ({ ...p, [name]: value }));
  };

  const handleReviewChange = (e) => {
    const { name, value } = e.target;
    setReviewForm((p) => ({ ...p, [name]: value }));
  };

  const handleFeedbackChange = (e) => {
    const { name, value } = e.target;
    setFeedbackForm((p) => ({ ...p, [name]: value }));
  };

  // ─────────────────────────────────────────────────────────────
  // Submit Evaluation
  // ─────────────────────────────────────────────────────────────
  const submitEvaluation = async (e) => {
    e.preventDefault();
    setApiMsg(null);
    try {
      const res  = await authFetch(`performance_api.php?action=add_evaluation`, {
        method: "POST",
        body: JSON.stringify(evaluationForm),
      });
      const json = await res.json();
      if (json.status === "success") {
        setApiMsg({ type: "success", text: json.message });
        setEvaluationForm({ employee_id: "", rating: "", comments: "" });
        loadEvaluations();
      } else {
        setApiMsg({ type: "error", text: json.message });
      }
    } catch {
      setApiMsg({ type: "error", text: "Could not reach server." });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Submit Goal
  // ─────────────────────────────────────────────────────────────
  const submitGoal = async (e) => {
    e.preventDefault();
    setApiMsg(null);
    try {
      const res  = await authFetch(`performance_api.php?action=add_goal`, {
        method: "POST",
        body: JSON.stringify(goalForm),
      });
      const json = await res.json();
      if (json.status === "success") {
        setApiMsg({ type: "success", text: json.message });
        setGoalForm({ employee_id: "", goal_description: "", deadline: "" });
        loadGoals();
      } else {
        setApiMsg({ type: "error", text: json.message });
      }
    } catch {
      setApiMsg({ type: "error", text: "Could not reach server." });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Update Goal Status
  // ─────────────────────────────────────────────────────────────
  const updateGoalStatus = async (goal_id, status) => {
    setApiMsg(null);
    try {
      const res  = await authFetch(`performance_api.php?action=update_goal_status`, {
        method: "POST",
        body: JSON.stringify({ goal_id, status }),
      });
      const json = await res.json();
      if (json.status === "success") {
        setApiMsg({ type: "success", text: json.message });
        loadGoals();
      } else {
        setApiMsg({ type: "error", text: json.message });
      }
    } catch {
      setApiMsg({ type: "error", text: "Could not reach server." });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Submit Review
  // ─────────────────────────────────────────────────────────────
  const submitReview = async (e) => {
    e.preventDefault();
    setApiMsg(null);
    try {
      const res  = await authFetch(`performance_api.php?action=add_review`, {
        method: "POST",
        body: JSON.stringify(reviewForm),
      });
      const json = await res.json();
      if (json.status === "success") {
        setApiMsg({ type: "success", text: json.message });
        setReviewForm({ employee_id: "", review_text: "", reviewer: "" });
        loadReviews();
      } else {
        setApiMsg({ type: "error", text: json.message });
      }
    } catch {
      setApiMsg({ type: "error", text: "Could not reach server." });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Submit Feedback
  // ─────────────────────────────────────────────────────────────
  const submitFeedback = async (e) => {
    e.preventDefault();
    setApiMsg(null);
    try {
      const res  = await authFetch(`performance_api.php?action=add_feedback`, {
        method: "POST",
        body: JSON.stringify(feedbackForm),
      });
      const json = await res.json();
      if (json.status === "success") {
        setApiMsg({ type: "success", text: json.message });
        setFeedbackForm({ employee_id: "", feedback_text: "", submitted_by: "" });
        loadFeedback();
      } else {
        setApiMsg({ type: "error", text: json.message });
      }
    } catch {
      setApiMsg({ type: "error", text: "Could not reach server." });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Delete Functions
  // ─────────────────────────────────────────────────────────────
  const deleteItem = async (type, idField, idValue) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    setApiMsg(null);
    try {
      const res  = await authFetch(`performance_api.php?action=delete_${type}`, {
        method: "POST",
        body: JSON.stringify({ [idField]: idValue }),
      });
      const json = await res.json();
      if (json.status === "success") {
        setApiMsg({ type: "success", text: json.message });
        if (type === "evaluation") loadEvaluations();
        if (type === "goal")       loadGoals();
        if (type === "review")     loadReviews();
        if (type === "feedback")   loadFeedback();
      } else {
        setApiMsg({ type: "error", text: json.message });
      }
    } catch {
      setApiMsg({ type: "error", text: "Could not reach server." });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Generate Report CSV
  // ─────────────────────────────────────────────────────────────
  const generateReport = async () => {
    setApiMsg(null);
    try {
      const p   = new URLSearchParams({
        action: "generate_report",
        type:   reportType,
        from:   fromDate,
        to:     toDate,
        format: "csv",
      });
      const res = await authFetch(`performance_api.php?${p}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `performance_${reportType}_${fromDate}_to_${toDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      setApiMsg({ type: "success", text: "Report downloaded." });
    } catch {
      setApiMsg({ type: "error", text: "Failed to generate report." });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Render Tabs
  // ─────────────────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case "evaluations":
        return (
          <div className="tab-content">
            <h2>Evaluations</h2>
            <p>Conduct and record employee performance evaluations.</p>

            <ApiMsg msg={apiMsg} />

            <form onSubmit={submitEvaluation} className="evaluation-form">
              <label>Employee *</label>
              <select
                name="employee_id"
                value={evaluationForm.employee_id}
                onChange={handleEvaluationChange}
                required
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>

              <label>Rating *</label>
              <select
                name="rating"
                value={evaluationForm.rating}
                onChange={handleEvaluationChange}
                required
              >
                <option value="">Select Rating</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Satisfactory">Satisfactory</option>
                <option value="Needs Improvement">Needs Improvement</option>
              </select>

              <label>Comments</label>
              <textarea
                name="comments"
                value={evaluationForm.comments}
                onChange={handleEvaluationChange}
                placeholder="Additional feedback..."
              />

              <button type="submit">Submit Evaluation</button>
              <button
                type="button"
                onClick={() =>
                  setEvaluationForm({ employee_id: "", rating: "", comments: "" })
                }
              >
                Cancel
              </button>
            </form>

            <div className="filters">
              <input
                type="text"
                placeholder="Search evaluations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="button" className="btn" onClick={loadEvaluations}>
                Search
              </button>
            </div>

            <h3>Recent Evaluations</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Rating</th>
                  <th>Date</th>
                  <th>Comments</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: 20 }}>Loading...</td>
                  </tr>
                ) : evaluations.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: 20 }}>No evaluations found.</td>
                  </tr>
                ) : (
                  evaluations.map((ev) => (
                    <tr key={ev.evaluation_id}>
                      <td>{ev.employee_name}</td>
                      <td>{ev.rating}</td>
                      <td>{ev.evaluation_date}</td>
                      <td>{ev.comments || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn-sm btn-sm--delete"
                          onClick={() => deleteItem("evaluation", "evaluation_id", ev.evaluation_id)}
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

      case "goals":
        return (
          <div className="tab-content">
            <h2>Goals</h2>
            <p>Set and track employee performance goals.</p>

            <ApiMsg msg={apiMsg} />

            <form className="goal-form" onSubmit={submitGoal}>
              <label>Employee *</label>
              <select
                name="employee_id"
                value={goalForm.employee_id}
                onChange={handleGoalChange}
                required
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>

              <label>Goal Description *</label>
              <textarea
                name="goal_description"
                value={goalForm.goal_description}
                onChange={handleGoalChange}
                placeholder="Describe the goal..."
                required
              />

              <label>Deadline</label>
              <input
                type="date"
                name="deadline"
                value={goalForm.deadline}
                onChange={handleGoalChange}
              />

              <button type="submit" className="btn">Set Goal</button>
            </form>

            <div className="filters">
              <input
                type="text"
                placeholder="Search goals..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="button" className="btn" onClick={loadGoals}>Search</button>
            </div>

            <h3>Current Goals</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Goal</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: 20 }}>Loading...</td>
                  </tr>
                ) : goals.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: 20 }}>No goals found.</td>
                  </tr>
                ) : (
                  goals.map((g) => (
                    <tr key={g.goal_id}>
                      <td>{g.employee_name}</td>
                      <td>{g.goal_description}</td>
                      <td>{g.deadline || "—"}</td>
                      <td>
                        <select
                          value={g.status}
                          onChange={(e) => updateGoalStatus(g.goal_id, e.target.value)}
                        >
                          <option>Pending</option>
                          <option>In Progress</option>
                          <option>Completed</option>
                        </select>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn-sm btn-sm--delete"
                          onClick={() => deleteItem("goal", "goal_id", g.goal_id)}
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

      case "reviews":
        return (
          <div className="tab-content">
            <h2>Reviews</h2>
            <p>View and manage past performance reviews.</p>

            <ApiMsg msg={apiMsg} />

            <form className="review-form" onSubmit={submitReview}>
              <label>Employee *</label>
              <select
                name="employee_id"
                value={reviewForm.employee_id}
                onChange={handleReviewChange}
                required
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>

              <label>Reviewer *</label>
              <input
                type="text"
                name="reviewer"
                value={reviewForm.reviewer}
                onChange={handleReviewChange}
                required
              />

              <label>Review *</label>
              <textarea
                name="review_text"
                value={reviewForm.review_text}
                onChange={handleReviewChange}
                required
              />

              <button type="submit">Submit Review</button>
            </form>

            <div className="filters">
              <input
                type="text"
                placeholder="Search reviews..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="button" className="btn" onClick={loadReviews}>Search</button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Reviewer</th>
                  <th>Review</th>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: 20 }}>Loading...</td>
                  </tr>
                ) : reviews.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: 20 }}>No reviews found.</td>
                  </tr>
                ) : (
                  reviews.map((r) => (
                    <tr key={r.review_id}>
                      <td>{r.employee_name}</td>
                      <td>{r.reviewer}</td>
                      <td>{r.review_text}</td>
                      <td>{r.review_date}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn-sm btn-sm--delete"
                          onClick={() => deleteItem("review", "review_id", r.review_id)}
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
            <p>Generate performance reports (CSV download).</p>

            <ApiMsg msg={apiMsg} />

            <form className="report-form" onSubmit={(e) => e.preventDefault()}>
              <label>Report Type</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
                <option value="evaluation_summary">Evaluation Summary</option>
                <option value="goal_achievement">Goal Achievement</option>
              </select>

              <label>Start Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />

              <label>End Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />

              <button type="button" onClick={generateReport}>Generate Report</button>
            </form>
          </div>
        );

      case "feedback":
        return (
          <div className="tab-content">
            <h2>Feedback</h2>
            <p>Collect and manage employee feedback.</p>

            <ApiMsg msg={apiMsg} />

            <form className="feedback-form" onSubmit={submitFeedback}>
              <label>Employee *</label>
              <select
                name="employee_id"
                value={feedbackForm.employee_id}
                onChange={handleFeedbackChange}
                required
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>

              <label>Submitted By</label>
              <input
                type="text"
                name="submitted_by"
                value={feedbackForm.submitted_by}
                onChange={handleFeedbackChange}
              />

              <label>Feedback *</label>
              <textarea
                name="feedback_text"
                value={feedbackForm.feedback_text}
                onChange={handleFeedbackChange}
                required
              />

              <button type="submit">Submit Feedback</button>
            </form>

            <div className="filters">
              <input
                type="text"
                placeholder="Search feedback..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="button" className="btn" onClick={loadFeedback}>Search</button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Feedback</th>
                  <th>Submitted By</th>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: 20 }}>Loading...</td>
                  </tr>
                ) : feedbacks.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: 20 }}>No feedback found.</td>
                  </tr>
                ) : (
                  feedbacks.map((f) => (
                    <tr key={f.feedback_id}>
                      <td>{f.employee_name}</td>
                      <td>{f.feedback_text}</td>
                      <td>{f.submitted_by}</td>
                      <td>{f.feedback_date}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn-sm btn-sm--delete"
                          onClick={() => deleteItem("feedback", "feedback_id", f.feedback_id)}
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

      default:
        return <div>Select a tab.</div>;
    }
  };

  return (
    <div className="content-area">
      <nav className="tabs" role="tablist">
        <button className={activeTab === "evaluations" ? "active" : ""} onClick={() => setActiveTab("evaluations")}>
          Evaluations
        </button>
        <button className={activeTab === "goals" ? "active" : ""} onClick={() => setActiveTab("goals")}>
          Goals
        </button>
        <button className={activeTab === "reviews" ? "active" : ""} onClick={() => setActiveTab("reviews")}>
          Reviews
        </button>
        <button className={activeTab === "reports" ? "active" : ""} onClick={() => setActiveTab("reports")}>
          Reports
        </button>
        <button className={activeTab === "feedback" ? "active" : ""} onClick={() => setActiveTab("feedback")}>
          Feedback
        </button>
      </nav>

      {renderContent()}
    </div>
  );
}

export default PerformanceContentArea;