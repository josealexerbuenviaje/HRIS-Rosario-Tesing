<?php
// ============================================================
//  interview_results.php
//  GET    /interview_results.php           — list all results (filter: applicant_id, result)
//  GET    /interview_results.php?id=N      — single result
//  POST   /interview_results.php           — add result
//  PUT    /interview_results.php?id=N      — edit result
//  DELETE /interview_results.php?id=N      — delete (Admin/HR only)
// ============================================================
require_once 'cors.php';
require_once 'db.php';
require_once 'jwt_helper.php';

$auth   = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET ───────────────────────────────────────────────────────────────────────
if ($method === 'GET') {

    if (!empty($_GET['id'])) {
        $id   = (int)$_GET['id'];
        $stmt = $conn->prepare("
            SELECT
                ir.*,
                CONCAT(a.first_name, ' ', a.last_name) AS applicant,
                jp.title  AS position,
                CONCAT(u.first_name, ' ', u.last_name) AS interviewer
            FROM interview_results ir
            JOIN applicants   a  ON a.id = ir.applicant_id
            LEFT JOIN job_posting jp ON jp.id = a.job_posting_id
            LEFT JOIN users   u  ON u.id = ir.interviewed_by
            WHERE ir.id = ?
        ");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        $conn->close();

        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Result not found.']);
            exit;
        }
        echo json_encode(['success' => true, 'data' => $row]);
        exit;
    }

    // List
    $conditions = [];
    $params     = [];
    $types      = '';

    if (!empty($_GET['applicant_id'])) {
        $conditions[] = 'ir.applicant_id = ?';
        $params[]     = (int)$_GET['applicant_id'];
        $types       .= 'i';
    }
    if (!empty($_GET['result']) && in_array($_GET['result'], ['Pass','Fail','Hold'])) {
        $conditions[] = 'ir.result = ?';
        $params[]     = $_GET['result'];
        $types       .= 's';
    }

    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

    $sql = "
        SELECT
            ir.id,
            ir.result,
            ir.notes,
            ir.interviewed_at,
            CONCAT(a.first_name, ' ', a.last_name) AS applicant,
            jp.title  AS position,
            CONCAT(u.first_name, ' ', u.last_name) AS interviewer
        FROM interview_results ir
        JOIN applicants   a  ON a.id = ir.applicant_id
        LEFT JOIN job_posting jp ON jp.id = a.job_posting_id
        LEFT JOIN users   u  ON u.id = ir.interviewed_by
        $where
        ORDER BY ir.interviewed_at DESC
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

// ── POST — create ─────────────────────────────────────────────────────────────
if ($method === 'POST') {
    requireRole($auth, ['Admin', 'HR', 'Manager']);

    $body = json_decode(file_get_contents('php://input'), true);

    $applicant_id   = (int)($body['applicant_id']   ?? 0);
    $result         = $body['result']               ?? '';
    $notes          = trim($body['notes']           ?? '');
    $interviewed_at = trim($body['interviewed_at']  ?? date('Y-m-d H:i:s'));

    if (!$applicant_id || !in_array($result, ['Pass','Fail','Hold'])) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'applicant_id and a valid result (Pass/Fail/Hold) are required.']);
        exit;
    }

    // Validate applicant exists
    $check = $conn->prepare("SELECT id FROM applicants WHERE id=? LIMIT 1");
    $check->bind_param('i', $applicant_id);
    $check->execute();
    if (!$check->get_result()->fetch_assoc()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Applicant not found.']);
        $check->close(); $conn->close();
        exit;
    }
    $check->close();

    $stmt = $conn->prepare("
        INSERT INTO interview_results (applicant_id, interviewed_by, result, notes, interviewed_at)
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->bind_param('iisss', $applicant_id, $auth->sub, $result, $notes, $interviewed_at);
    $stmt->execute();
    $newId = $stmt->insert_id;
    $stmt->close();

    // Auto-update applicant status to Interviewed if not already further along
    $update = $conn->prepare("
        UPDATE applicants
        SET status='Interviewed'
        WHERE id=? AND status IN ('Pending','Screening')
    ");
    $update->bind_param('i', $applicant_id);
    $update->execute();
    $update->close();
    $conn->close();

    http_response_code(201);
    echo json_encode(['success' => true, 'id' => $newId, 'message' => 'Interview result recorded.']);
    exit;
}

// ── PUT — update ──────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    requireRole($auth, ['Admin', 'HR', 'Manager']);

    $id   = (int)($_GET['id'] ?? 0);
    $body = json_decode(file_get_contents('php://input'), true);

    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing result ID.']);
        exit;
    }

    $result         = $body['result']              ?? '';
    $notes          = trim($body['notes']          ?? '');
    $interviewed_at = trim($body['interviewed_at'] ?? '');

    if (!in_array($result, ['Pass','Fail','Hold'])) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Valid result (Pass/Fail/Hold) is required.']);
        exit;
    }

    $stmt = $conn->prepare("
        UPDATE interview_results
        SET result=?, notes=?, interviewed_at=?
        WHERE id=?
    ");
    $stmt->bind_param('sssi', $result, $notes, $interviewed_at, $id);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();
    $conn->close();

    if ($affected === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Result not found.']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Interview result updated.']);
    exit;
}

// ── DELETE ────────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    requireRole($auth, ['Admin', 'HR']);

    $id = (int)($_GET['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing result ID.']);
        exit;
    }

    $stmt = $conn->prepare("DELETE FROM interview_results WHERE id=?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();
    $conn->close();

    if ($affected === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Result not found.']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Interview result deleted.']);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed.']);