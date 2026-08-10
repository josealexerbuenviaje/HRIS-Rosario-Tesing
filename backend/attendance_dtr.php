<?php
// ============================================================
//  attendance_dtr.php
//  Handles: get_stats | get_dtr | get_logs | sync_logs
//  GET  ?action=get_stats&date=&dept_id=
//  GET  ?action=get_dtr&date=&dept_id=&search=&page=&per_page=
//  GET  ?action=get_logs&limit=
//  POST ?action=sync_logs
// ============================================================
require_once 'cors.php';
require_once 'db.php';
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$action = trim($_GET['action'] ?? $_POST['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'];

if (!$action) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Missing action parameter"]);
    exit;
}

try {
    // ════════════════════════════════════════════════════════
    // GET STATS
    // ════════════════════════════════════════════════════════
    if ($action === 'get_stats' && $method === 'GET') {
        $date    = trim($_GET['date']    ?? date('Y-m-d'));
        $dept_id = trim($_GET['dept_id'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) $date = date('Y-m-d');

        $deptSql = $dept_id !== '' ? "AND e.dept_id = ?" : "";
        $otDept  = $dept_id !== '' ? "AND oe.dept_id = ?" : "";

        $sql = "
            SELECT
                SUM(a.status = 'Present' AND TIME(a.time_in) <= '08:01:00') AS present,
                SUM(a.status = 'Present' AND TIME(a.time_in) >  '08:01:00') AS late,
                SUM(a.status = 'Absent')                                     AS absent,
                SUM(a.status = 'On Leave')                                   AS on_leave,
                (SELECT COUNT(*) FROM overtime ot
                 JOIN employee oe ON ot.employee_id = oe.employee_id
                 WHERE ot.ot_date = ? AND ot.status = 'Approved' $otDept)   AS overtime
            FROM attendance a
            JOIN employee e ON a.employee_id = e.employee_id
            WHERE a.attendance_date = ?
            $deptSql
        ";

        $stmt = $conn->prepare($sql);
        if ($dept_id !== '') {
            $stmt->bind_param('ssss', $date, $dept_id, $date, $dept_id);
        } else {
            $stmt->bind_param('ss', $date, $date);
        }
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        echo json_encode([
            "status" => "success",
            "data"   => [
                "present"  => (int)($row['present']  ?? 0),
                "late"     => (int)($row['late']     ?? 0),
                "absent"   => (int)($row['absent']   ?? 0),
                "on_leave" => (int)($row['on_leave'] ?? 0),
                "overtime" => (int)($row['overtime'] ?? 0),
            ],
        ]);

    // ════════════════════════════════════════════════════════
    // GET DTR
    // ════════════════════════════════════════════════════════
    } elseif ($action === 'get_dtr' && $method === 'GET') {
        $date    = trim($_GET['date']     ?? date('Y-m-d'));
        $dept_id = trim($_GET['dept_id']  ?? '');
        $search  = trim($_GET['search']   ?? '');
        $page    = max(1, (int)($_GET['page']     ?? 1));
        $perPage = min(50, max(1, (int)($_GET['per_page'] ?? 15)));
        $offset  = ($page - 1) * $perPage;

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) $date = date('Y-m-d');

        $conditions = ["a.attendance_date = ?"];
        $params     = [$date];
        $types      = "s";

        if ($dept_id !== '') {
            $conditions[] = "e.dept_id = ?";
            $params[] = $dept_id; $types .= "s";
        }
        if ($search !== '') {
            $conditions[] = "(e.last_name LIKE ? OR e.first_name LIKE ? OR e.employee_no LIKE ?)";
            $like = "%$search%";
            $params[] = $like; $params[] = $like; $params[] = $like;
            $types .= "sss";
        }

        $where = "WHERE " . implode(" AND ", $conditions);

        $stmt = $conn->prepare("
            SELECT
                a.attendance_id, a.employee_id,
                e.employee_no,
                CONCAT(e.last_name, ', ', e.first_name,
                    IF(e.middle_name IS NOT NULL AND e.middle_name != '',
                       CONCAT(' ', LEFT(e.middle_name,1), '.'), '')) AS full_name,
                d.dept_name,
                TIME_FORMAT(a.time_in,  '%h:%i %p') AS time_in,
                TIME_FORMAT(a.time_out, '%h:%i %p') AS time_out,
                a.hours_worked, a.status, a.remarks
            FROM attendance a
            JOIN employee   e ON a.employee_id = e.employee_id
            JOIN department d ON e.dept_id     = d.dept_id
            $where
            ORDER BY e.last_name ASC
            LIMIT ? OFFSET ?
        ");

        $params[] = $perPage; $types .= "i";
        $params[] = $offset;  $types .= "i";
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
        $data = [];
        while ($row = $result->fetch_assoc()) $data[] = $row;
        $stmt->close();

        echo json_encode(["status" => "success", "data" => $data, "page" => $page]);

    // ════════════════════════════════════════════════════════
    // GET LOGS
    // ════════════════════════════════════════════════════════
    } elseif ($action === 'get_logs' && $method === 'GET') {
        $limit = min(200, max(1, (int)($_GET['limit'] ?? 50)));

        $stmt = $conn->prepare("
            SELECT
                al.log_id, al.log_type,
                DATE_FORMAT(al.log_time, '%h:%i:%s %p') AS log_time,
                al.device,
                CONCAT(e.last_name, ', ', e.first_name) AS full_name,
                e.employee_no, d.dept_name
            FROM attendance_log al
            JOIN employee   e ON al.employee_id = e.employee_id
            JOIN department d ON e.dept_id      = d.dept_id
            ORDER BY al.log_time DESC
            LIMIT ?
        ");
        $stmt->bind_param('i', $limit);
        $stmt->execute();
        $result = $stmt->get_result();
        $data = [];
        while ($row = $result->fetch_assoc()) $data[] = $row;
        $stmt->close();

        echo json_encode(["status" => "success", "data" => $data]);

    // ════════════════════════════════════════════════════════
    // SYNC LOGS
    // ════════════════════════════════════════════════════════
    } elseif ($action === 'sync_logs' && $method === 'POST') {
        $today = date('Y-m-d');

        $stmt = $conn->prepare("
            INSERT INTO attendance (employee_id, attendance_date, time_in, time_out, status, hours_worked)
            SELECT
                al.employee_id,
                DATE(al.log_time) AS attendance_date,
                MIN(CASE WHEN al.log_type = 'Time In'  THEN TIME(al.log_time) END) AS time_in,
                MAX(CASE WHEN al.log_type = 'Time Out' THEN TIME(al.log_time) END) AS time_out,
                CASE
                    WHEN MIN(CASE WHEN al.log_type = 'Time In' THEN TIME(al.log_time) END) > '08:01:00' THEN 'Late'
                    WHEN MIN(CASE WHEN al.log_type = 'Time In' THEN TIME(al.log_time) END) IS NOT NULL  THEN 'Present'
                    ELSE 'Absent'
                END AS status,
                ROUND(TIMESTAMPDIFF(MINUTE,
                    MIN(CASE WHEN al.log_type = 'Time In'  THEN al.log_time END),
                    MAX(CASE WHEN al.log_type = 'Time Out' THEN al.log_time END)
                ) / 60, 2) AS hours_worked
            FROM attendance_log al
            WHERE DATE(al.log_time) = ?
            GROUP BY al.employee_id, DATE(al.log_time)
            ON DUPLICATE KEY UPDATE
                time_in      = VALUES(time_in),
                time_out     = VALUES(time_out),
                status       = VALUES(status),
                hours_worked = VALUES(hours_worked)
        ");
        $stmt->bind_param('s', $today);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();

        echo json_encode(["status" => "success", "message" => "Sync complete. $affected record(s) updated."]);

    } else {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Invalid action or method: $action"]);
    }

} catch (mysqli_sql_exception $e) {
    error_log("[attendance_dtr] $action — " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An unexpected error occurred."]);
} finally {
    $conn->close();
}
?>