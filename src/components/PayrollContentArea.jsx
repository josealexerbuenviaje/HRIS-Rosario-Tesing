import React, { useState } from 'react';
import './css_components/ContentArea.css'; // Reuse or copy the CSS file

function PayrollContentArea() {
  const [activeTab, setActiveTab] = useState('salaryManagement');

  // State for salary form
  const [salaryForm, setSalaryForm] = useState({
    employee: '',
    baseSalary: '',
    allowances: '',
  });

  // Sample data for lists (replace with API data)
  const [salaries, setSalaries] = useState([
    { id: 1, employee: 'John Doe', baseSalary: 50000, allowances: 2000 },
    { id: 2, employee: 'Jane Smith', baseSalary: 55000, allowances: 2500 },
  ]);
  const [payslips, setPayslips] = useState([
    { id: 1, employee: 'John Doe', period: 'Oct 2023', netPay: 48000 },
    { id: 2, employee: 'Jane Smith', period: 'Oct 2023', netPay: 52000 },

    
  ]);
  const [deductions, setDeductions] = useState([
    { id: 1, employee: 'John Doe', type: 'Tax', amount: 5000 },
  ]);

  const handleSalaryFormChange = (e) => {
    const { name, value } = e.target;
    setSalaryForm({ ...salaryForm, [name]: value });
  };

  const handleSalarySubmit = (e) => {
    e.preventDefault();
    setSalaries([...salaries, { ...salaryForm, id: salaries.length + 1 }]);
    setSalaryForm({ employee: '', baseSalary: '', allowances: '' });
    alert('Salary updated!');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'salaryManagement':
        return (
          <div className="tab-content">
            <h2>Salary Management</h2>
            <p>Update employee salaries and allowances. Ensure compliance with government pay scales.</p>
            <form onSubmit={handleSalarySubmit} className="salary-form">
              <label htmlFor="employee">Employee *</label>
              <input
                type="text"
                id="employee"
                name="employee"
                value={salaryForm.employee}
                onChange={handleSalaryFormChange}
                required
              />
              <label htmlFor="baseSalary">Base Salary *</label>
              <input
                type="number"
                id="baseSalary"
                name="baseSalary"
                value={salaryForm.baseSalary}
                onChange={handleSalaryFormChange}
                required
              />
              <label htmlFor="allowances">Allowances</label>
              <input
                type="number"
                id="allowances"
                name="allowances"
                value={salaryForm.allowances}
                onChange={handleSalaryFormChange}
              />
              <button type="submit">Update Salary</button>
              <button type="button" onClick={() => setSalaryForm({ employee: '', baseSalary: '', allowances: '' })}>Cancel</button>
            </form>
            <h3>Current Salaries</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Base Salary</th>
                  <th>Allowances</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {salaries.map((sal) => (
                  <tr key={sal.id}>
                    <td>{sal.employee}</td>
                    <td>${sal.baseSalary}</td>
                    <td>${sal.allowances}</td>
                    <td><button>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'payrollRun':
        return (
          <div className="tab-content">
            <h2>Payroll Run</h2>
            <p>Process payroll for the current period. Review and confirm before finalizing.</p>
            <div className="payroll-run">
              <label htmlFor="period">Payroll Period</label>
              <select id="period">
                <option>October 2023</option>
                <option>November 2023</option>
              </select>
              <button>Run Payroll</button>
              <button>Preview</button>
            </div>
            <h3>Payroll Summary</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Gross Pay</th>
                  <th>Deductions</th>
                  <th>Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((slip) => (
                  <tr key={slip.id}>
                    <td>{slip.employee}</td>
                    <td>${slip.netPay + 5000}</td> {/* Placeholder gross */}
                    <td>$5000</td>
                    <td>${slip.netPay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="custom-btn">
                <button>Finalize Payroll</button>
            </div>    
          </div>
        );

      case 'deductions':
        return (
          <div className="tab-content">
            <h2>Deductions</h2>
            <p>Manage employee deductions (e.g., taxes, insurance).</p>
            <form className="deduction-form">
              <label htmlFor="empDeduct">Employee</label>
              <select id="empDeduct">
                <option>Select Employee</option>
                {salaries.map((sal) => (
                  <option key={sal.id}>{sal.employee}</option>
                ))}
              </select>
              <label htmlFor="type">Deduction Type</label>
              <select id="type">
                <option>Tax</option>
                <option>Insurance</option>
                <option>Retirement</option>
              </select>
              <label htmlFor="amount">Amount</label>
              <input type="number" id="amount" />
              <button type="button">Add Deduction</button>
            </form>
            <h3>Current Deductions</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deductions.map((ded) => (
                  <tr key={ded.id}>
                    <td>{ded.employee}</td>
                    <td>{ded.type}</td>
                    <td>${ded.amount}</td>
                    <td><button>Edit</button> <button>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'payslips':
        return (
          <div className="tab-content">
            <h2>Payslips</h2>
            <p>View and distribute employee payslips.</p>
            <div className="filters">
              <select>
                <option>All</option>
                <option>October 2023</option>
              </select>
              <input type="text" placeholder="Search by employee..." />
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Period</th>
                  <th>Net Pay</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((slip) => (
                  <tr key={slip.id}>
                    <td>{slip.employee}</td>
                    <td>{slip.period}</td>
                    <td>${slip.netPay}</td>
                    <td><button>View</button> <button>Download</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="custom-btn">
                <button>Generate Payslips</button>
            </div>
          </div>
        );

      case 'reports':
        return (
          <div className="tab-content">
            <h2>Reports</h2>
            <p>Generate payroll reports for auditing and compliance.</p>
            <form className="report-form">
              <label htmlFor="reportType">Report Type</label>
              <select id="reportType">
                <option>Salary Summary</option>
                <option>Deduction Report</option>
                <option>Payroll History</option>
              </select>
              <label htmlFor="startRange">Start Date</label>
              <input type="date" id="startRange" />
              <label htmlFor="endRange">End Date</label>
              <input type="date" id="endRange" />
              <button type="button">Generate Report</button>
            </form>
            <div className="report-preview">
              <p>Report preview will appear here after generation.</p>
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
          className={activeTab === 'salaryManagement' ? 'active' : ''}
          onClick={() => setActiveTab('salaryManagement')}
          role="tab"
        >
          Salary Management
        </button>
        <button
          className={activeTab === 'payrollRun' ? 'active' : ''}
          onClick={() => setActiveTab('payrollRun')}
          role="tab"
        >
          Payroll Run
        </button>
        <button
          className={activeTab === 'deductions' ? 'active' : ''}
          onClick={() => setActiveTab('deductions')}
          role="tab"
        >
          Deductions
        </button>
        <button
          className={activeTab === 'payslips' ? 'active' : ''}
          onClick={() => setActiveTab('payslips')}
          role="tab"
        >
          Payslips
        </button>
        <button
          className={activeTab === 'reports' ? 'active' : ''}
          onClick={() => setActiveTab('reports')}
          role="tab"
        >
          Reports
        </button>
      </nav>
      {renderContent()}
    </div>
  );
}

export default PayrollContentArea;