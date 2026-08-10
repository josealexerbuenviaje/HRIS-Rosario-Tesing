import React, { useState } from 'react';
import './css_components/ContentArea.css'; // Reuse or copy the CSS file

function ReportsContentArea() {
  const [activeTab, setActiveTab] = useState('hrOverview');

  // State for report generation form
  const [reportForm, setReportForm] = useState({
    type: '',
    startDate: '',
    endDate: '',
  });

  // Sample report data (replace with API-generated data)
  const [reportPreview, setReportPreview] = useState(null);

  const handleReportFormChange = (e) => {
    const { name, value } = e.target;
    setReportForm({ ...reportForm, [name]: value });
  };

  const handleGenerateReport = () => {
    // Simulate report generation
    setReportPreview(`Generated ${reportForm.type} report from ${reportForm.startDate} to ${reportForm.endDate}.`);
    alert('Report generated!');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'hrOverview':
        return (
          <div className="tab-content">
            <h2>HR Overview Reports</h2>
            <p>Generate high-level reports on HR metrics, such as employee count, turnover, and compliance.</p>
            <form className="report-generate-form">
              <label htmlFor="type">Report Type</label>
              <select
                id="type"
                name="type"
                value={reportForm.type}
                onChange={handleReportFormChange}
              >
                <option value="">Select Type</option>
                <option value="Employee Count">Employee Count</option>
                <option value="Turnover Rate">Turnover Rate</option>
                <option value="Compliance Summary">Compliance Summary</option>
              </select>
              <label htmlFor="startDate">Start Date</label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={reportForm.startDate}
                onChange={handleReportFormChange}
              />
              <label htmlFor="endDate">End Date</label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={reportForm.endDate}
                onChange={handleReportFormChange}
              />
              <button type="button" onClick={handleGenerateReport}>Generate Report</button>
            </form>
            <div className="report-preview">
              {reportPreview ? <p>{reportPreview}</p> : <p>Report preview will appear here.</p>}
            </div>
            <div className="export-options">
              <button>Export PDF</button>
              <button>Export CSV</button>
            </div>
          </div>
        );

      case 'leaveReports':
        return (
          <div className="tab-content">
            <h2>Leave Reports</h2>
            <p>Generate reports on leave usage, balances, and trends.</p>
            <form className="report-generate-form">
              <label htmlFor="type">Report Type</label>
              <select
                id="type"
                name="type"
                value={reportForm.type}
                onChange={handleReportFormChange}
              >
                <option value="">Select Type</option>
                <option value="Leave Balances">Leave Balances</option>
                <option value="Leave Trends">Leave Trends</option>
              </select>
              <label htmlFor="startDate">Start Date</label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={reportForm.startDate}
                onChange={handleReportFormChange}
              />
              <label htmlFor="endDate">End Date</label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={reportForm.endDate}
                onChange={handleReportFormChange}
              />
              <button type="button" onClick={handleGenerateReport}>Generate Report</button>
            </form>
            <div className="report-preview">
              {reportPreview ? <p>{reportPreview}</p> : <p>Report preview will appear here.</p>}
            </div>
            <div className="export-options">
              <button>Export PDF</button>
              <button>Export CSV</button>
            </div>
          </div>
        );

      case 'recruitmentReports':
        return (
          <div className="tab-content">
            <h2>Recruitment Reports</h2>
            <p>Generate reports on job postings, applicants, and hiring success.</p>
            <form className="report-generate-form">
              <label htmlFor="type">Report Type</label>
              <select
                id="type"
                name="type"
                value={reportForm.type}
                onChange={handleReportFormChange}
              >
                <option value="">Select Type</option>
                <option value="Applicant Summary">Applicant Summary</option>
                <option value="Hiring Metrics">Hiring Metrics</option>
              </select>
              <label htmlFor="startDate">Start Date</label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={reportForm.startDate}
                onChange={handleReportFormChange}
              />
              <label htmlFor="endDate">End Date</label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={reportForm.endDate}
                onChange={handleReportFormChange}
              />
              <button type="button" onClick={handleGenerateReport}>Generate Report</button>
            </form>
            <div className="report-preview">
              {reportPreview ? <p>{reportPreview}</p> : <p>Report preview will appear here.</p>}
            </div>
            <div className="export-options">
              <button>Export PDF</button>
              <button>Export CSV</button>
            </div>
          </div>
        );

      case 'performanceReports':
        return (
          <div className="tab-content">
            <h2>Performance Reports</h2>
            <p>Generate reports on evaluations, goals, and feedback.</p>
            <form className="report-generate-form">
              <label htmlFor="type">Report Type</label>
              <select
                id="type"
                name="type"
                value={reportForm.type}
                onChange={handleReportFormChange}
              >
                <option value="">Select Type</option>
                <option value="Evaluation Summary">Evaluation Summary</option>
                <option value="Goal Achievement">Goal Achievement</option>
              </select>
              <label htmlFor="startDate">Start Date</label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={reportForm.startDate}
                onChange={handleReportFormChange}
              />
              <label htmlFor="endDate">End Date</label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={reportForm.endDate}
                onChange={handleReportFormChange}
              />
              <button type="button" onClick={handleGenerateReport}>Generate Report</button>
            </form>
            <div className="report-preview">
              {reportPreview ? <p>{reportPreview}</p> : <p>Report preview will appear here.</p>}
            </div>
            <div className="export-options">
              <button>Export PDF</button>
              <button>Export CSV</button>
            </div>
          </div>
        );

      case 'customReports':
        return (
          <div className="tab-content">
            <h2>Custom Reports</h2>
            <p>Create and generate custom reports by selecting parameters.</p>
            <form className="report-generate-form">
              <label htmlFor="type">Custom Report Type</label>
              <input
                type="text"
                id="type"
                name="type"
                value={reportForm.type}
                onChange={handleReportFormChange}
                placeholder="e.g., Diversity Report"
              />
              <label htmlFor="startDate">Start Date</label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={reportForm.startDate}
                onChange={handleReportFormChange}
              />
              <label htmlFor="endDate">End Date</label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={reportForm.endDate}
                onChange={handleReportFormChange}
              />
              <button type="button" onClick={handleGenerateReport}>Generate Custom Report</button>
            </form>
            <div className="report-preview">
              {reportPreview ? <p>{reportPreview}</p> : <p>Report preview will appear here.</p>}
            </div>
            <div className="export-options">
              <button>Export PDF</button>
              <button>Export CSV</button>
            </div>
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
          className={activeTab === 'hrOverview' ? 'active' : ''}
          onClick={() => setActiveTab('hrOverview')}
          role="tab"
        >
          HR Overview
        </button>
        <button
          className={activeTab === 'leaveReports' ? 'active' : ''}
          onClick={() => setActiveTab('leaveReports')}
          role="tab"
        >
          Leave Reports
        </button>
        <button
          className={activeTab === 'recruitmentReports' ? 'active' : ''}
          onClick={() => setActiveTab('recruitmentReports')}
          role="tab"
        >
          Recruitment Reports
        </button>
        <button
          className={activeTab === 'performanceReports' ? 'active' : ''}
          onClick={() => setActiveTab('performanceReports')}
          role="tab"
        >
          Performance Reports
        </button>
        <button
          className={activeTab === 'customReports' ? 'active' : ''}
          onClick={() => setActiveTab('customReports')}
          role="tab"
        >
          Custom Reports
        </button>
      </nav>
      {renderContent()}
    </div>
  );
}

export default ReportsContentArea;