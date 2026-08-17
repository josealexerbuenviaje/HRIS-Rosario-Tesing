<?php
// ============================================================
//  attendance_reports.php
//  Handles: generate_report
//  GET ?action=generate_report&type=daily&from=&to=&dept_id=&format=csv|xlsx|pdf
// ============================================================
require_once 'bootstrap.php';
$auth = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];
$action = trim($_GET['action'] ?? '');

if (!$action) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Missing action parameter"]);
    exit;
}

try {
    // ════════════════════════════════════════════════════════
    // GENERATE REPORT
    // ════════════════════════════════════════════════════════
    if ($action === 'generate_report' && $method === 'GET') {
        $type    = trim($_GET['type']    ?? 'daily');
        $from    = trim($_GET['from']    ?? date('Y-m-d'));
        $to      = trim($_GET['to']      ?? date('Y-m-d'));
        $dept_id = trim($_GET['dept_id'] ?? '');
        $format  = trim($_GET['format']  ?? 'csv');

        // Validate dates
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) $from = date('Y-m-d');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $to))   $to   = date('Y-m-d');

        // Validate format
        if (!in_array($format, ['csv', 'xlsx', 'pdf'], true)) $format = 'csv';

        // ── Build query based on report type ───────────────
        $deptJoin = "";
        $deptWhere = "";
        $params = [$from, $to];
        $types  = "ss";

        if ($dept_id !== '') {
            $deptWhere = "AND e.dept_id = ?";
            $params[]  = $dept_id;
            $types    .= "s";
        }

        switch ($type) {
            case 'tardiness':
                $sql = "
                    SELECT
                        e.employee_no,
                        CONCAT(e.last_name, ', ', e.first_name) AS full_name,
                        d.dept_name,
                        a.attendance_date,
                        TIME_FORMAT(a.time_in, '%h:%i %p') AS time_in,
                        TIMESTAMPDIFF(MINUTE, '08:00:00', a.time_in) AS minutes_late
                    FROM attendance a
                    JOIN employee   e ON a.employee_id = e.employee_id
                    JOIN department d ON e.dept_id     = d.dept_id
                    WHERE a.attendance_date BETWEEN ? AND ?
                      AND a.status = 'Late'
                      $deptWhere
                    ORDER BY a.attendance_date ASC, e.last_name ASC
                ";
                break;

            case 'ot':
                $sql = "
                    SELECT
                        e.employee_no,
                        CONCAT(e.last_name, ', ', e.first_name) AS full_name,
                        d.dept_name,
                        ot.ot_date, ot.ot_start, ot.ot_end,
                        ot.ot_hours, ot.reason, ot.status
                    FROM overtime ot
                    JOIN employee   e ON ot.employee_id = e.employee_id
                    JOIN department d ON e.dept_id      = d.dept_id
                    WHERE ot.ot_date BETWEEN ? AND ?
                      $deptWhere
                    ORDER BY ot.ot_date ASC, e.last_name ASC
                ";
                break;

            case 'ob':
                $sql = "
                    SELECT
                        e.employee_no,
                        CONCAT(e.last_name, ', ', e.first_name) AS full_name,
                        d.dept_name,
                        ob.ob_date, ob.destination, ob.purpose,
                        ob.time_out, ob.time_in, ob.status
                    FROM official_business ob
                    JOIN employee   e ON ob.employee_id = e.employee_id
                    JOIN department d ON e.dept_id      = d.dept_id
                    WHERE ob.ob_date BETWEEN ? AND ?
                      $deptWhere
                    ORDER BY ob.ob_date ASC, e.last_name ASC
                ";
                break;

            case 'absent':
                $sql = "
                    SELECT
                        e.employee_no,
                        CONCAT(e.last_name, ', ', e.first_name) AS full_name,
                        d.dept_name,
                        a.attendance_date,
                        a.status, a.remarks
                    FROM attendance a
                    JOIN employee   e ON a.employee_id = e.employee_id
                    JOIN department d ON e.dept_id     = d.dept_id
                    WHERE a.attendance_date BETWEEN ? AND ?
                      AND a.status = 'Absent'
                      $deptWhere
                    ORDER BY a.attendance_date ASC, e.last_name ASC
                ";
                break;

            case 'monthly':
                $sql = "
                    SELECT
                        e.employee_no,
                        CONCAT(e.last_name, ', ', e.first_name) AS full_name,
                        d.dept_name,
                        COUNT(CASE WHEN a.status = 'Present' THEN 1 END) AS days_present,
                        COUNT(CASE WHEN a.status = 'Late'    THEN 1 END) AS days_late,
                        COUNT(CASE WHEN a.status = 'Absent'  THEN 1 END) AS days_absent,
                        SUM(a.hours_worked)                               AS total_hours
                    FROM attendance a
                    JOIN employee   e ON a.employee_id = e.employee_id
                    JOIN department d ON e.dept_id     = d.dept_id
                    WHERE a.attendance_date BETWEEN ? AND ?
                      $deptWhere
                    GROUP BY e.employee_id, e.employee_no, e.last_name, e.first_name, d.dept_name
                    ORDER BY e.last_name ASC
                ";
                break;

            default: // daily
                $sql = "
                    SELECT
                        e.employee_no,
                        CONCAT(e.last_name, ', ', e.first_name) AS full_name,
                        d.dept_name,
                        a.attendance_date,
                        TIME_FORMAT(a.time_in,  '%h:%i %p') AS time_in,
                        TIME_FORMAT(a.time_out, '%h:%i %p') AS time_out,
                        a.hours_worked, a.status, a.remarks
                    FROM attendance a
                    JOIN employee   e ON a.employee_id = e.employee_id
                    JOIN department d ON e.dept_id     = d.dept_id
                    WHERE a.attendance_date BETWEEN ? AND ?
                      $deptWhere
                    ORDER BY a.attendance_date ASC, e.last_name ASC
                ";
        }

        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();

        $rows = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;
        $stmt->close();

        // ── Output as CSV (xlsx/pdf would need a library) ──
        $filename = "attendance_{$type}_{$from}_to_{$to}";

        if ($format === 'csv') {
            header('Content-Type: text/csv');
            header("Content-Disposition: attachment; filename=\"{$filename}.csv\"");

            $out = fopen('php://output', 'w');
            if (!empty($rows)) {
                fputcsv($out, array_keys($rows[0])); // headers
                foreach ($rows as $row) fputcsv($out, $row);
            }
            fclose($out);
        } else {
            // For xlsx/pdf — return JSON for now (implement with PhpSpreadsheet/TCPDF if needed)
            header('Content-Type: application/json');
            echo json_encode([
                "status"  => "info",
                "message" => "XLSX/PDF export requires PhpSpreadsheet or TCPDF library. Returning data as JSON.",
                "data"    => $rows,
            ]);
        }

    } else {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Invalid action or method: $action"]);
    }

} catch (mysqli_sql_exception $e) {
    error_log("[attendance_reports] $action — " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An unexpected error occurred."]);
} finally {
    $conn->close();
}
?>