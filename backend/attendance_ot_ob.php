<?php
// ============================================================
//  attendance_ot_ob.php
//  Handles: get_overtime | update_overtime | get_ob | update_ob
//  GET  ?action=get_overtime&date=&dept_id=&search=
//  POST ?action=update_overtime   body: {ot_id, status}
//  GET  ?action=get_ob&date=&dept_id=&search=
//  POST ?action=update_ob         body: {ob_id, status}
// ============================================================
rrequire_once 'bootstrap.php';
$method = $_SERVER['REQUEST_METHOD'];
$action = trim($_GET['action'] ?? '');

// For POST, also allow action in body
if ($method === 'POST' && !$action) {
    $body   = json_decode(file_get_contents("php://input"), true) ?? [];
    $action = trim($body['action'] ?? '');
} else {
    $body = $method === 'POST'
        ? (json_decode(file_get_contents("php://input"), true) ?? [])
        : [];
}

if (!$action) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Missing action parameter"]);
    exit;
}

// ── Shared filter builder ─────────────────────────────────────────────────────
function buildFilters(array $get, string $dateCol, string $deptCol): array {
    $conditions = []; $params = []; $types = "";

    $date    = trim($get['date']    ?? '');
    $dept_id = trim($get['dept_id'] ?? '');
    $search  = trim($get['search']  ?? '');

    if ($date    !== '') { $conditions[] = "$dateCol = ?"; $params[] = $date;    $types .= "s"; }
    if ($dept_id !== '') { $conditions[] = "$deptCol = ?"; $params[] = $dept_id; $types .= "s"; }
    if ($search  !== '') {
        $conditions[] = "(e.last_name LIKE ? OR e.first_name LIKE ?)";
        $like = "%$search%";
        $params[] = $like; $params[] = $like; $types .= "ss";
    }

    $where = $conditions ? "WHERE " . implode(" AND ", $conditions) : "";
    return [$where, $params, $types];
}

// ── Shared approve/reject handler ─────────────────────────────────────────────
function handleApproval(mysqli $conn, string $table, string $idCol, array $body): void {
    $id     = trim($body[$idCol] ?? '');
    $status = trim($body['status'] ?? '');

    if (!$id || !in_array($status, ['Approved', 'Rejected'], true)) {
        http_response_code(422);
        echo json_encode(["status" => "error", "message" => "Invalid $idCol or status"]);
        return;
    }

    $stmt = $conn->prepare("UPDATE $table SET status = ? WHERE $idCol = ?");
    $stmt->bind_param('ss', $status, $id);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();

    if ($affected === 0) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Record not found"]);
        return;
    }

    echo json_encode(["status" => "success", "message" => "Request $status."]);
}

try {
    // ════════════════════════════════════════════════════════
    // GET OVERTIME
    // ════════════════════════════════════════════════════════
    if ($action === 'get_overtime' && $method === 'GET') {
        [$where, $params, $types] = buildFilters($_GET, 'ot.ot_date', 'e.dept_id');

        $stmt = $conn->prepare("
            SELECT ot.ot_id, ot.ot_date, ot.ot_start, ot.ot_end,
                   ot.ot_hours, ot.reason, ot.status,
                   CONCAT(e.last_name, ', ', e.first_name) AS full_name,
                   d.dept_name
            FROM overtime ot
            JOIN employee   e ON ot.employee_id = e.employee_id
            JOIN department d ON e.dept_id      = d.dept_id
            $where
            ORDER BY ot.ot_date DESC
        ");
        if ($types) $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $data = [];
        $r    = $stmt->get_result();
        while ($row = $r->fetch_assoc()) $data[] = $row;
        $stmt->close();

        echo json_encode(["status" => "success", "data" => $data]);

    // ════════════════════════════════════════════════════════
    // UPDATE OVERTIME
    // ════════════════════════════════════════════════════════
    } elseif ($action === 'update_overtime' && $method === 'POST') {
        handleApproval($conn, 'overtime', 'ot_id', $body);

    // ════════════════════════════════════════════════════════
    // GET OFFICIAL BUSINESS
    // ════════════════════════════════════════════════════════
    } elseif ($action === 'get_ob' && $method === 'GET') {
        [$where, $params, $types] = buildFilters($_GET, 'ob.ob_date', 'e.dept_id');

        $stmt = $conn->prepare("
            SELECT ob.ob_id, ob.ob_date, ob.destination, ob.purpose,
                   ob.time_out, ob.time_in, ob.status,
                   CONCAT(e.last_name, ', ', e.first_name) AS full_name,
                   d.dept_name
            FROM official_business ob
            JOIN employee   e ON ob.employee_id = e.employee_id
            JOIN department d ON e.dept_id      = d.dept_id
            $where
            ORDER BY ob.ob_date DESC
        ");
        if ($types) $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $data = [];
        $r    = $stmt->get_result();
        while ($row = $r->fetch_assoc()) $data[] = $row;
        $stmt->close();

        echo json_encode(["status" => "success", "data" => $data]);

    // ════════════════════════════════════════════════════════
    // UPDATE OFFICIAL BUSINESS
    // ════════════════════════════════════════════════════════
    } elseif ($action === 'update_ob' && $method === 'POST') {
        handleApproval($conn, 'official_business', 'ob_id', $body);

    } else {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Invalid action or method: $action"]);
    }

} catch (mysqli_sql_exception $e) {
    error_log("[attendance_ot_ob] $action — " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An unexpected error occurred."]);
} finally {
    $conn->close();
}
?>