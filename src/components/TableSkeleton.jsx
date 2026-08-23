import React from "react";
import "./TableSkeleton.css";

// ============================================================
//  TableSkeleton — drop-in replacement for a plain "Loading…" row
//
//  Usage inside a <tbody>:
//    {loading ? (
//      <TableSkeleton columns={6} rows={5} />
//    ) : data.length === 0 ? (
//      <tr><td colSpan={6}>No records found.</td></tr>
//    ) : (
//      data.map(...)
//    )}
//
//  Renders `rows` number of <tr> elements, each with `columns`
//  animated skeleton bars — matches the pulse animation already
//  used in DepartmentsTab.css / users_table.jsx.
// ============================================================
export default function TableSkeleton({ columns = 5, rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="tsk-row" style={{ animationDelay: `${r * 70}ms` }}>
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c}>
              <div
                className="tsk-bar"
                style={{ width: `${55 + ((r + c) % 4) * 10}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
