<?php
// ============================================================
//  leave_api.php
//  Handles all leave management actions
//  GET  ?action=get_employees
//  GET  ?action=get_leave_types
//  GET  ?action=get_requests&status=&search=&dept_id=
//  GET  ?action=get_credits&search=&dept_id=
//  GET  ?action=get_calendar&month=&year=
//  POST ?action=file_leave
//  POST ?action=update_status  body: {leave_id, status, comment}
//  GET  ?action=generate_report&type=&from=&to=&dept_id=&format=
// ============================================================
require_once 'cors.php';
require_once 'db.php';
require_once 'jwt_helper.php';
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// ── Auth ──────────────────────────────────────────────────────────────────────
$auth   = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];
$action = trim($_GET['action'] ?? '');

if (!$action) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Missing action"]);
    exit;
}

try {

    // ════════════════════════════════════════════════════════
    // GET EMPLOYEES — for File Leave employee selector
    // ════════════════════════════════════════════════════════
    if ($action === 'get_employees' && $method === 'GET') {
        $search  = trim($_GET['search']  ?? '');
        $dept_id = trim($_GET['dept_id'] ?? '');

        $conditions = ["e.employment_status NOT IN ('Separated','Retired','AWOL','Deceased')"];
        $params = []; $types = "";

        if ($search !== '') {
            $conditions[] = "(e.last_name LIKE ? OR e.first_name LIKE ? OR e.employee_no LIKE ?)";
            $like = "%$search%";
            $params[] = $like; $params[] = $like; $params[] = $like;
            $types .= "sss";
        }
        if ($dept_id !== '') {
            $conditions[] = "e.dept_id = ?";
            $params[] = $dept_id; $types .= "s";
        }

        $where = "WHERE " . implode(" AND ", $conditions);

        $stmt = $conn->prepare("
            SELECT e.employee_id, e.employee_no,
                   CONCAT(e.last_name, ', ', e.first_name,
                       IF(e.middle_name IS NOT NULL AND e.middle_name != '',
                          CONCAT(' ', LEFT(e.middle_name,1), '.'), '')) AS full_name,
                   e.sex, e.position_title, d.dept_name
            FROM employee e
            JOIN department d ON e.dept_id = d.dept_id
            $where
            ORDER BY e.last_name ASC
            LIMIT 50
        ");
        if ($types) $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $data = []; $r = $stmt->get_result();
        while ($row = $r->fetch_assoc()) $data[] = $row;
        $stmt->close();

        echo json_encode(["status" => "success", "data" => $data]);

    // ════════════════════════════════════════════════════════
    // GET LEAVE TYPES
    // ════════════════════════════════════════════════════════
    } elseif ($action === 'get_leave_types' && $method === 'GET') {
        $stmt = $conn->prepare("SELECT * FROM leave_type WHERE status = 'Active' ORDER BY leave_name ASC");
        $stmt->execute();
        $data = []; $r = $stmt->get_result();
        while ($row = $r->fetch_assoc()) $data[] = $row;
        $stmt->close();

        echo json_encode(["status" => "success", "data" => $data]);

    // ════════════════════════════════════════════════════════
    // FILE LEAVE — admin files on behalf of employee
    // ════════════════════════════════════════════════════════
    } elseif ($action === 'file_leave' && $method === 'POST') {
        requireRole($auth, ['HR', 'Admin']);

        $data = json_decode(file_get_contents("php://input"), true);

        $employee_id  = trim($data['employee_id']  ?? '');
        $leave_type   = trim($data['leave_type_id'] ?? '');
        $start_date   = trim($data['start_date']   ?? '');
        $end_date     = trim($data['end_date']      ?? '');
        $reason       = trim($data['reason']        ?? '');
        $filed_by     = $auth->user_id;

        // Validate required
        $missing = [];
        if (!$employee_id) $missing[] = 'employee_id';
        if (!$leave_type)  $missing[] = 'leave_type_id';
        if (!$start_date)  $missing[] = 'start_date';
        if (!$end_date)    $missing[] = 'end_date';

        if ($missing) {
            http_response_code(422);
            echo json_encode(["status" => "error", "message" => "Missing: " . implode(', ', $missing)]);
            exit;
        }

        // Validate dates
        if ($end_date < $start_date) {
            http_response_code(422);
            echo json_encode(["status" => "error", "message" => "End date cannot be before start date."]);
            exit;
        }

        // Check employee exists
        $chk = $conn->prepare("SELECT employee_id, sex FROM employee WHERE employee_id = ? LIMIT 1");
        $chk->bind_param('s', $employee_id);
        $chk->execute();
        $emp = $chk->get_result()->fetch_assoc();
        $chk->close();

        if (!$emp) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Employee not found."]);
            exit;
        }

        // Check maternity only for female employees
        $ltChk = $conn->prepare("SELECT leave_name FROM leave_type WHERE leave_type_id = ? LIMIT 1");
        $ltChk->bind_param('s', $leave_type);
        $ltChk->execute();
        $lt = $ltChk->get_result()->fetch_assoc();
        $ltChk->close();

        if ($lt && strtolower($lt['leave_name']) === 'maternity' && strtolower($emp['sex']) !== 'female') {
            http_response_code(422);
            echo json_encode(["status" => "error", "message" => "Maternity leave is only available for female employees."]);
            exit;
        }

        // Calculate days (excluding weekends)
        $days = 0;
        $cur  = new DateTime($start_date);
        $end  = new DateTime($end_date);
        while ($cur <= $end) {
            $dow = (int)$cur->format('N');
            if ($dow < 6) $days++; // Mon–Fri
            $cur->modify('+1 day');
        }

        // Generate leave_id
        $seq = $conn->query("SELECT COUNT(*) AS c FROM leave_request")->fetch_assoc()['c'] + 1;
        $leave_id = "LV-" . str_pad($seq, 5, '0', STR_PAD_LEFT);

        $stmt = $conn->prepare("
            INSERT INTO leave_request
                (leave_id, employee_id, leave_type_id, start_date, end_date,
                 days_applied, reason, status, filed_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?, NOW())
        ");
        $stmt->bind_param('sssssiss', $leave_id, $employee_id, $leave_type,
            $start_date, $end_date, $days, $reason, $filed_by);
        $stmt->execute();
        $stmt->close();

        echo json_encode([
            "status"   => "success",
            "message"  => "Leave request filed successfully.",
            "leave_id" => $leave_id,
            "days"     => $days,
        ]);

    // ════════════════════════════════════════════════════════
    // GET REQUESTS — for Approvals tab
    // ════════════════════════════════════════════════════════
    } elseif ($action === 'get_requests' && $method === 'GET') {
        $status  = trim($_GET['status']  ?? '');
        $search  = trim($_GET['search']  ?? '');
        $dept_id = trim($_GET['dept_id'] ?? '');

        $conditions = []; $params = []; $types = "";

        if ($status  !== '' && $status !== 'All') {
            $conditions[] = "lr.status = ?"; $params[] = $status; $types .= "s";
        }
        if ($dept_id !== '') {
            $conditions[] = "e.dept_id = ?"; $params[] = $dept_id; $types .= "s";
        }
        if ($search  !== '') {
            $conditions[] = "(e.last_name LIKE ? OR e.first_name LIKE ?)";
            $like = "%$search%"; $params[] = $like; $params[] = $like; $types .= "ss";
        }

        $where = $conditions ? "WHERE " . implode(" AND ", $conditions) : "";

        $stmt = $conn->prepare("
            SELECT lr.leave_id, lr.start_date, lr.end_date, lr.days_applied,
                   lr.reason, lr.status, lr.created_at,
                   lt.leave_name, lt.leave_type_id,
                   CONCAT(e.last_name, ', ', e.first_name) AS full_name,
                   e.employee_no, e.sex, d.dept_name
            FROM leave_request lr
            JOIN employee    e  ON lr.employee_id   = e.employee_id
            JOIN department  d  ON e.dept_id        = d.dept_id
            JOIN leave_type  lt ON lr.leave_type_id = lt.leave_type_id
            $where
            ORDER BY lr.created_at DESC
        ");
        if ($types) $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $data = []; $r = $stmt->get_result();
        while ($row = $r->fetch_assoc()) $data[] = $row;
        $stmt->close();

        echo json_encode(["status" => "success", "data" => $data]);

    // ════════════════════════════════════════════════════════
    // UPDATE STATUS — approve or reject
    // ════════════════════════════════════════════════════════
    } elseif ($action === 'update_status' && $method === 'POST') {
        requireRole($auth, ['HR', 'Admin']);

        $data     = json_decode(file_get_contents("php://input"), true);
        $leave_id = trim($data['leave_id'] ?? '');
        $status   = trim($data['status']   ?? '');
        $comment  = trim($data['comment']  ?? '');
        $valid    = ['Approved', 'Rejected'];

        if (!$leave_id || !in_array($status, $valid, true)) {
            http_response_code(422);
            echo json_encode(["status" => "error", "message" => "Invalid leave_id or status."]);
            exit;
        }

        $stmt = $conn->prepare("
            UPDATE leave_request
            SET status = ?, approved_by = ?, comment = ?, updated_at = NOW()
            WHERE leave_id = ?
        ");
        $stmt->bind_param('ssss', $status, $auth->user_id, $comment, $leave_id);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();

        if ($affected === 0) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Leave request not found."]);
            exit;
        }

        // If approved — deduct from leave credits
        if ($status === 'Approved') {
            $lrStmt = $conn->prepare("
                SELECT employee_id, leave_type_id, days_applied FROM leave_request WHERE leave_id = ?
            ");
            $lrStmt->bind_param('s', $leave_id);
            $lrStmt->execute();
            $lr = $lrStmt->get_result()->fetch_assoc();
            $lrStmt->close();

            if ($lr) {
                $deductStmt = $conn->prepare("
                    UPDATE leave_credit
                    SET days_used = days_used + ?, days_remaining = days_remaining - ?
                    WHERE employee_id = ? AND leave_type_id = ?
                ");
                $deductStmt->bind_param('iiss',
                    $lr['days_applied'], $lr['days_applied'],
                    $lr['employee_id'],  $lr['leave_type_id']);
                $deductStmt->execute();
                $deductStmt->close();
            }
        }

        echo json_encode(["status" => "success", "message" => "Leave request $status."]);

    // ════════════════════════════════════════════════════════
    // GET CREDITS — table of all employees' leave balances
    // ════════════════════════════════════════════════════════
    } elseif ($action === 'get_credits' && $method === 'GET') {
        $search  = trim($_GET['search']  ?? '');
        $dept_id = trim($_GET['dept_id'] ?? '');

        $conditions = ["e.employment_status NOT IN ('Separated','Retired','AWOL','Deceased')"];
        $params = []; $types = "";

        if ($search  !== '') {
            $conditions[] = "(e.last_name LIKE ? OR e.first_name LIKE ? OR e.employee_no LIKE ?)";
            $like = "%$search%"; $params[] = $like; $params[] = $like; $params[] = $like; $types .= "sss";
        }
        if ($dept_id !== '') {
            $conditions[] = "e.dept_id = ?"; $params[] = $dept_id; $types .= "s";
        }

        $where = "WHERE " . implode(" AND ", $conditions);

        $stmt = $conn->prepare("
            SELECT
                e.employee_id, e.employee_no, e.sex,
                CONCAT(e.last_name, ', ', e.first_name) AS full_name,
                e.position_title, d.dept_name,
                -- Annual Leave
                MAX(CASE WHEN lt.leave_name = 'Annual Leave'    THEN lc.days_total     END) AS annual_total,
                MAX(CASE WHEN lt.leave_name = 'Annual Leave'    THEN lc.days_used      END) AS annual_used,
                MAX(CASE WHEN lt.leave_name = 'Annual Leave'    THEN lc.days_remaining END) AS annual_remaining,
                -- Sick Leave
                MAX(CASE WHEN lt.leave_name = 'Sick Leave'      THEN lc.days_total     END) AS sick_total,
                MAX(CASE WHEN lt.leave_name = 'Sick Leave'      THEN lc.days_used      END) AS sick_used,
                MAX(CASE WHEN lt.leave_name = 'Sick Leave'      THEN lc.days_remaining END) AS sick_remaining,
                -- Maternity (female only)
                MAX(CASE WHEN lt.leave_name = 'Maternity Leave' THEN lc.days_total     END) AS maternity_total,
                MAX(CASE WHEN lt.leave_name = 'Maternity Leave' THEN lc.days_used      END) AS maternity_used,
                MAX(CASE WHEN lt.leave_name = 'Maternity Leave' THEN lc.days_remaining END) AS maternity_remaining
            FROM employee e
            JOIN department  d  ON e.dept_id      = d.dept_id
            LEFT JOIN leave_credit lc ON e.employee_id = lc.employee_id
            LEFT JOIN leave_type   lt ON lc.leave_type_id = lt.leave_type_id
            $where
            GROUP BY e.employee_id, e.employee_no, e.sex, full_name,
                     e.position_title, d.dept_name
            ORDER BY e.last_name ASC
        ");
        if ($types) $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $data = []; $r = $stmt->get_result();
        while ($row = $r->fetch_assoc()) $data[] = $row;
        $stmt->close();

        echo json_encode(["status" => "success", "data" => $data]);

    // ════════════════════════════════════════════════════════
    // GET CALENDAR
    // ════════════════════════════════════════════════════════
    } elseif ($action === 'get_calendar' && $method === 'GET') {
        $month = (int)($_GET['month'] ?? date('n'));
        $year  = (int)($_GET['year']  ?? date('Y'));

        $from = sprintf('%04d-%02d-01', $year, $month);
        $to   = date('Y-m-t', strtotime($from));

        $stmt = $conn->prepare("
            SELECT lr.leave_id, lr.start_date, lr.end_date, lr.status,
                   lt.leave_name,
                   CONCAT(e.last_name, ', ', e.first_name) AS full_name,
                   d.dept_name
            FROM leave_request lr
            JOIN employee   e  ON lr.employee_id   = e.employee_id
            JOIN department d  ON e.dept_id        = d.dept_id
            JOIN leave_type lt ON lr.leave_type_id = lt.leave_type_id
            WHERE lr.status = 'Approved'
              AND lr.start_date <= ? AND lr.end_date >= ?
            ORDER BY lr.start_date ASC
        ");
        $stmt->bind_param('ss', $to, $from);
        $stmt->execute();
        $data = []; $r = $stmt->get_result();
        while ($row = $r->fetch_assoc()) $data[] = $row;
        $stmt->close();

        echo json_encode(["status" => "success", "data" => $data, "month" => $month, "year" => $year]);

    // ════════════════════════════════════════════════════════
    // GENERATE REPORT
    // ════════════════════════════════════════════════════════
    } elseif ($action === 'generate_report' && $method === 'GET') {
        requireRole($auth, ['HR', 'Admin']);

        $type    = trim($_GET['type']    ?? 'individual');
        $from    = trim($_GET['from']    ?? date('Y-01-01'));
        $to      = trim($_GET['to']      ?? date('Y-m-d'));
        $dept_id = trim($_GET['dept_id'] ?? '');
        $format  = trim($_GET['format']  ?? 'csv');

        $params = [$from, $to]; $types = "ss";
        $deptWhere = "";
        if ($dept_id !== '') { $deptWhere = "AND e.dept_id = ?"; $params[] = $dept_id; $types .= "s"; }

        $stmt = $conn->prepare("
            SELECT
                e.employee_no,
                CONCAT(e.last_name, ', ', e.first_name) AS full_name,
                d.dept_name, lt.leave_name,
                lr.start_date, lr.end_date, lr.days_applied,
                lr.status, lr.reason, lr.created_at
            FROM leave_request lr
            JOIN employee   e  ON lr.employee_id   = e.employee_id
            JOIN department d  ON e.dept_id        = d.dept_id
            JOIN leave_type lt ON lr.leave_type_id = lt.leave_type_id
            WHERE lr.start_date BETWEEN ? AND ?
            $deptWhere
            ORDER BY lr.start_date ASC, e.last_name ASC
        ");
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $rows = []; $r = $stmt->get_result();
        while ($row = $r->fetch_assoc()) $rows[] = $row;
        $stmt->close();

        $filename = "leave_report_{$from}_to_{$to}";

        header('Content-Type: text/csv');
        header("Content-Disposition: attachment; filename=\"{$filename}.csv\"");

        $out = fopen('php://output', 'w');
        if (!empty($rows)) {
            fputcsv($out, array_keys($rows[0]));
            foreach ($rows as $row) fputcsv($out, $row);
        }
        fclose($out);

    } else {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Invalid action or method: $action"]);
    }

} catch (mysqli_sql_exception $e) {
    error_log("[leave_api] $action — " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An unexpected error occurred."]);
} finally {
    $conn->close();
}
?>