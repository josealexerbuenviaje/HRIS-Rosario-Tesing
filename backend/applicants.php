<?php
// ============================================================
//  applicants.php
//  GET    /applicants.php                      — list (filters: status, job_posting_id, search)
//  GET    /applicants.php?id=N                 — single applicant
//  POST   /applicants.php                      — add applicant
//  PUT    /applicants.php?id=N                 — update applicant / status
//  DELETE /applicants.php?id=N                 — hard delete (Admin only)
// ============================================================
require_once 'bootstrap.php';

// ── GET ───────────────────────────────────────────────────────────────────────
if ($method === 'GET') {

    // Single record
    if (!empty($_GET['id'])) {
        $id   = (int)$_GET['id'];
        $stmt = $conn->prepare("
            SELECT
                a.*,
                CONCAT(a.first_name, ' ', a.last_name) AS name,
                jp.title AS job_title,
                jp.department
            FROM applicants a
            LEFT JOIN job_posting jp ON jp.id = a.job_posting_id
            WHERE a.id = ?
        ");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        $conn->close();

        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Applicant not found.']);
            exit;
        }

        echo json_encode(['success' => true, 'data' => $row]);
        exit;
    }

    // List with optional filters
    $conditions = [];
    $params     = [];
    $types      = '';

    $valid_statuses = ['Pending','Screening','Interviewed','Offered','Hired','Rejected'];

    if (!empty($_GET['status']) && in_array($_GET['status'], $valid_statuses)) {
        $conditions[] = 'a.status = ?';
        $params[]     = $_GET['status'];
        $types       .= 's';
    }
    if (!empty($_GET['job_posting_id'])) {
        $conditions[] = 'a.job_posting_id = ?';
        $params[]     = (int)$_GET['job_posting_id'];
        $types       .= 'i';
    }
    if (!empty($_GET['search'])) {
        $conditions[] = "(CONCAT(a.first_name, ' ', a.last_name) LIKE ? OR a.email LIKE ?)";
        $like         = '%' . $_GET['search'] . '%';
        $params[]     = $like;
        $params[]     = $like;
        $types       .= 'ss';
    }

    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

    $sql = "
        SELECT
            a.id,
            CONCAT(a.first_name, ' ', a.last_name) AS name,
            a.first_name,
            a.last_name,
            a.email,
            a.phone,
            a.status,
            a.job_posting_id,
            jp.title  AS position,
            jp.department,
            a.created_at
        FROM applicants a
        LEFT JOIN job_posting jp ON jp.id = a.job_posting_id
        $where
        ORDER BY a.created_at DESC
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
    requireRole($auth, ['Admin', 'HR']);

    $body = json_decode(file_get_contents('php://input'), true);

    $first_name      = trim($body['first_name']     ?? '');
    $last_name       = trim($body['last_name']      ?? '');
    $email           = trim($body['email']          ?? '');
    $phone           = trim($body['phone']          ?? '');
    $job_posting_id  = !empty($body['job_posting_id']) ? (int)$body['job_posting_id'] : null;

    if (!$first_name || !$last_name || !$email) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'First name, last name, and email are required.']);
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Invalid email address.']);
        exit;
    }

    $stmt = $conn->prepare("
        INSERT INTO applicants (first_name, last_name, email, phone, job_posting_id, status)
        VALUES (?, ?, ?, ?, ?, 'Pending')
    ");
    $stmt->bind_param('ssssi', $first_name, $last_name, $email, $phone, $job_posting_id);
    $stmt->execute();
    $newId = $stmt->insert_id;
    $stmt->close();
    $conn->close();

    http_response_code(201);
    echo json_encode(['success' => true, 'id' => $newId, 'message' => 'Applicant added.']);
    exit;
}

// ── PUT — update ──────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    requireRole($auth, ['Admin', 'HR']);

    $id   = (int)($_GET['id'] ?? 0);
    $body = json_decode(file_get_contents('php://input'), true);

    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing applicant ID.']);
        exit;
    }

    $valid_statuses = ['Pending','Screening','Interviewed','Offered','Hired','Rejected'];

    // Status-only update (quick action from table)
    if (isset($body['status']) && count($body) === 1) {
        if (!in_array($body['status'], $valid_statuses)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Invalid status value.']);
            exit;
        }
        $stmt = $conn->prepare("UPDATE applicants SET status=? WHERE id=?");
        $stmt->bind_param('si', $body['status'], $id);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        $conn->close();

        if ($affected === 0) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Applicant not found.']);
            exit;
        }
        echo json_encode(['success' => true, 'message' => 'Status updated.']);
        exit;
    }

    // Full update
    $first_name     = trim($body['first_name']     ?? '');
    $last_name      = trim($body['last_name']      ?? '');
    $email          = trim($body['email']          ?? '');
    $phone          = trim($body['phone']          ?? '');
    $status         = in_array($body['status'] ?? '', $valid_statuses) ? $body['status'] : 'Pending';
    $job_posting_id = !empty($body['job_posting_id']) ? (int)$body['job_posting_id'] : null;

    if (!$first_name || !$last_name || !$email) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'First name, last name, and email are required.']);
        exit;
    }

    $stmt = $conn->prepare("
        UPDATE applicants
        SET first_name=?, last_name=?, email=?, phone=?, status=?, job_posting_id=?
        WHERE id=?
    ");
    $stmt->bind_param('sssssii', $first_name, $last_name, $email, $phone, $status, $job_posting_id, $id);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();
    $conn->close();

    if ($affected === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Applicant not found.']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Applicant updated.']);
    exit;
}

// ── DELETE ────────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    requireRole($auth, ['Admin']);

    $id = (int)($_GET['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing applicant ID.']);
        exit;
    }

    $stmt = $conn->prepare("DELETE FROM applicants WHERE id=?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();
    $conn->close();

    if ($affected === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Applicant not found.']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Applicant deleted.']);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed.']);