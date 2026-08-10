import React from "react";
import "./css_pages/Emp_table.css";
export default function Emp_contractual() {
  const contractualEmployees = [
    { id: 1, name: "Juan Dela Cruz", position: "Web Developer", department: "IT", startDate: "2024-01-15", endDate: "2026-07-15", status: "Active" },
    { id: 2, name: "Maria Santos", position: "HR Assistant", department: "HR", startDate: "2023-11-01", endDate: "2026-05-01", status: "Active" },
    { id: 3, name: "Carlos Reyes", position: "Designer", department: "Design", startDate: "2023-06-01", endDate: "2025-12-15", status: "Inactive" },
    { id: 4, name: "Ana Lopez", position: "QA Engineer", department: "IT", startDate: "2023-09-01", endDate: "2026-03-01", status: "Active" },
    { id: 5, name: "Mark Tan", position: "Support Specialist", department: "Support", startDate: "2023-08-15", endDate: "2025-11-30", status: "Inactive" },
    { id: 6, name: "Liza Cruz", position: "Marketing Assistant", department: "Marketing", startDate: "2024-02-01", endDate: "2026-08-01", status: "Active" },

  ];

  const today = new Date();

  // Calculate 3 months ahead
  const threeMonthsAhead = new Date();
  threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 1);
  
  // Upcoming contracts within next 3 months
  const upcomingContracts = contractualEmployees
    .filter(emp => {
      const endDate = new Date(emp.endDate);
      return endDate > today && endDate <= threeMonthsAhead;
    })
    .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
    .slice(0, 5);
  
  // Recently ended contracts: end date <= today
  const endedContracts = contractualEmployees
    .filter(emp => new Date(emp.endDate) <= today)
    .sort((a, b) => new Date(b.endDate) - new Date(a.endDate))
    .slice(0, 5);

  return (
    <div className="contractual-page layout-flex">
      {/* Main table */}
      <div className="main-table">
        <h2>Contractual Employees</h2>
        <div className="table-wrapper">
          <table className="employee-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Position</th>
                <th>Department</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {contractualEmployees.map((emp, index) => (
                <tr key={emp.id}>
                  <td>{index + 1}</td>
                  <td>{emp.name}</td>
                  <td>{emp.position}</td>
                  <td>{emp.department}</td>
                  <td>{emp.startDate}</td>
                  <td>{emp.endDate}</td>
                  <td>
                    <span className={`status ${emp.status.toLowerCase()}`}>{emp.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side tables */}
      <div className="side-tables">
        <div className="table-section">
          <h3>Upcoming Contracts</h3>
          <div className="table-wrapper">
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>End Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {upcomingContracts.map(emp => (
                  <tr key={emp.id}>
                    <td>{emp.name}</td>
                    <td>{emp.endDate}</td>
                    <td><span className={`status ${emp.status.toLowerCase()}`}>{emp.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="table-section">
          <h3>Recently Ended</h3>
          <div className="table-wrapper">
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>End Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {endedContracts.map(emp => (
                  <tr key={emp.id}>
                    <td>{emp.name}</td>
                    <td>{emp.endDate}</td>
                    <td><span className={`status ${emp.status.toLowerCase()}`}>{emp.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
