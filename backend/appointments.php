<?php
// ============================================================
//  appointments.php
//  GET    /appointments.php                  — list (filter: type, applicant_id, date)
//  POST   /appointments.php                  — schedule appointment
//  PUT    /appointments.php?id=N             — update appointment
//  DELETE /appointments.php?id=N             — cancel appointment
//
//  GET    /appointments.php?action=checklist&applicant_id=N  — get checklist progress
//  POST   /appointments.php?action=checklist                 — mark checklist item done/undone
// ============================================================
require_once 'bootstrap.php';
$auth = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ── Checklist — GET ───────────────────────────────────────────────────────────
if ($method === 'GET' && $action === 'checklist') {
    $applicant_id = (int)($_GET['applicant_id'] ?? 0);

    if (!$applicant_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'applicant_id is required.']);
        exit;
    }

    $stmt = $conn->prepare("
        SELECT
            ci.id,
            ci.label,
            ci.sort_order,
            COALESCE(op.is_done, 0)       AS is_done,
            op.completed_at
        FROM onboarding_checklist_items ci
        LEFT JOIN onboarding_progress op
               ON op.checklist_item_id = ci.id
              AND op.applicant_id = ?
        WHERE ci.is_active = 1
        ORDER BY ci.sort_order
    ");
    $stmt->bind_param('i', $applicant_id);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    $conn->close();

    echo json_encode(['success' => true, 'data' => $rows]);
    exit;
}

// ── Checklist — POST (toggle item) ────────────────────────────────────────────
if ($method === 'POST' && $action === 'checklist') {
    requireRole($auth, ['Admin', 'HR', 'Manager']);

    $body             = json_decode(file_get_contents('php://input'), true);
    $applicant_id     = (int)($body['applicant_id']      ?? 0);
    $checklist_item_id = (int)($body['checklist_item_id'] ?? 0);
    $is_done          = (int)(!empty($body['is_done']));   // 1 or 0

    if (!$applicant_id || !$checklist_item_id) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'applicant_id and checklist_item_id are required.']);
        exit;
    }

    $completed_at = $is_done ? date('Y-m-d H:i:s') : null;

    // Upsert
    $stmt = $conn->prepare("
        INSERT INTO onboarding_progress (applicant_id, checklist_item_id, is_done, completed_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE is_done=VALUES(is_done), completed_at=VALUES(completed_at)
    ");
    $stmt->bind_param('iiis', $applicant_id, $checklist_item_id, $is_done, $completed_at);
    $stmt->execute();
    $stmt->close();
    $conn->close();

    echo json_encode(['success' => true, 'message' => 'Checklist item updated.']);
    exit;
}

// ── GET — list appointments ───────────────────────────────────────────────────
if ($method === 'GET') {
    $conditions = [];
    $params     = [];
    $types      = '';

    if (!empty($_GET['type']) && in_array($_GET['type'], ['Interview','Onboarding'])) {
        $conditions[] = 'ap.type = ?';
        $params[]     = $_GET['type'];
        $types       .= 's';
    }
    if (!empty($_GET['applicant_id'])) {
        $conditions[] = 'ap.applicant_id = ?';
        $params[]     = (int)$_GET['applicant_id'];
        $types       .= 'i';
    }
    if (!empty($_GET['date'])) {
        $conditions[] = 'ap.appointment_date = ?';
        $params[]     = $_GET['date'];
        $types       .= 's';
    }

    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

    $sql = "
        SELECT
            ap.id,
            ap.type,
            ap.appointment_date,
            ap.notes,
            ap.created_at,
            CONCAT(a.first_name, ' ', a.last_name) AS applicant,
            jp.title   AS position,
            CONCAT(u.first_name, ' ', u.last_name) AS scheduled_by
        FROM appointments ap
        JOIN applicants   a  ON a.id  = ap.applicant_id
        LEFT JOIN job_posting jp ON jp.id = a.job_posting_id
        LEFT JOIN users   u  ON u.id  = ap.created_by
        $where
        ORDER BY ap.appointment_date ASC, ap.created_at DESC
    ";

    $stmt = $conn->prepare($sql);
    if ($types) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    $conn->close();

    echo json_encode(['success' => true, 'data' => $rows]);
    exit;
}

// ── POST — schedule ───────────────────────────────────────────────────────────
if ($method === 'POST') {
    requireRole($auth, ['Admin', 'HR', 'Manager']);

    $body         = json_decode(file_get_contents('php://input'), true);
    $applicant_id = (int)($body['applicant_id'] ?? 0);
    $type         = $body['type']               ?? '';
    $date         = trim($body['date']          ?? '');
    $notes        = trim($body['notes']         ?? '');

    if (!$applicant_id || !in_array($type, ['Interview','Onboarding']) || !$date) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'applicant_id, type, and date are required.']);
        exit;
    }

    // Validate date format
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Invalid date format. Use YYYY-MM-DD.']);
        exit;
    }

    $stmt = $conn->prepare("
        INSERT INTO appointments (applicant_id, type, appointment_date, notes, created_by)
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->bind_param('isssi', $applicant_id, $type, $date, $notes, $auth->sub);
    $stmt->execute();
    $newId = $stmt->insert_id;
    $stmt->close();
    $conn->close();

    http_response_code(201);
    echo json_encode(['success' => true, 'id' => $newId, 'message' => 'Appointment scheduled.']);
    exit;
}

// ── PUT — update ──────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    requireRole($auth, ['Admin', 'HR', 'Manager']);

    $id   = (int)($_GET['id'] ?? 0);
    $body = json_decode(file_get_contents('php://input'), true);

    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing appointment ID.']);
        exit;
    }

    $type  = in_array($body['type'] ?? '', ['Interview','Onboarding']) ? $body['type'] : null;
    $date  = trim($body['date']  ?? '');
    $notes = trim($body['notes'] ?? '');

    if (!$type || !$date) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'type and date are required.']);
        exit;
    }

    $stmt = $conn->prepare("
        UPDATE appointments SET type=?, appointment_date=?, notes=? WHERE id=?
    ");
    $stmt->bind_param('sssi', $type, $date, $notes, $id);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();
    $conn->close();

    if ($affected === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Appointment not found.']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Appointment updated.']);
    exit;
}

// ── DELETE ────────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    requireRole($auth, ['Admin', 'HR']);

    $id = (int)($_GET['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing appointment ID.']);
        exit;
    }

    $stmt = $conn->prepare("DELETE FROM appointments WHERE id=?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();
    $conn->close();

    if ($affected === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Appointment not found.']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Appointment cancelled.']);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed.']);