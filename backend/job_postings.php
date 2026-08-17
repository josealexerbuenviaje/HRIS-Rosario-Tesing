<?php
// ============================================================
//  job_postings.php
//  GET    /job_postings.php          — list all (filters: status, department, search)
//  POST   /job_postings.php          — create new posting
//  PUT    /job_postings.php?id=N     — update posting
//  DELETE /job_postings.php?id=N     — soft-close (sets status=Closed)
// ============================================================
require_once 'bootstrap.php';
$auth = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET — list ────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $conditions = [];
    $params     = [];
    $types      = '';

    if (!empty($_GET['status'])) {
        $conditions[] = 'jp.status = ?';
        $params[]     = $_GET['status'];
        $types       .= 's';
    }
    if (!empty($_GET['department'])) {
        $conditions[] = 'jp.department = ?';
        $params[]     = $_GET['department'];
        $types       .= 's';
    }
    if (!empty($_GET['search'])) {
        $conditions[] = '(jp.title LIKE ? OR jp.description LIKE ?)';
        $like         = '%' . $_GET['search'] . '%';
        $params[]     = $like;
        $params[]     = $like;
        $types       .= 'ss';
    }

    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

    $sql = "
        SELECT
            jp.id,
            jp.title,
            jp.department,
            jp.description,
            jp.requirements,
            jp.status,
            jp.created_at,
            CONCAT(u.first_name, ' ', u.last_name) AS posted_by,
            COUNT(a.id) AS applicant_count
        FROM job_posting jp
        LEFT JOIN users     u ON u.id = jp.created_by
        LEFT JOIN applicants a ON a.job_posting_id = jp.id
        $where
        GROUP BY jp.id
        ORDER BY jp.created_at DESC
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

    $title        = trim($body['title']        ?? '');
    $department   = trim($body['department']   ?? '');
    $description  = trim($body['description']  ?? '');
    $requirements = trim($body['requirements'] ?? '');
    $status       = in_array($body['status'] ?? '', ['Open','Draft']) ? $body['status'] : 'Open';

    if (!$title || !$department) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Title and department are required.']);
        exit;
    }

    $stmt = $conn->prepare("
        INSERT INTO job_posting (title, department, description, requirements, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $stmt->bind_param('sssssi', $title, $department, $description, $requirements, $status, $auth->sub);
    $stmt->execute();
    $newId = $stmt->insert_id;
    $stmt->close();
    $conn->close();

    http_response_code(201);
    echo json_encode(['success' => true, 'id' => $newId, 'message' => 'Job posting created.']);
    exit;
}

// ── PUT — update ──────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    requireRole($auth, ['Admin', 'HR', 'Manager']);

    $id   = (int)($_GET['id'] ?? 0);
    $body = json_decode(file_get_contents('php://input'), true);

    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing job posting ID.']);
        exit;
    }

    $allowed_statuses = ['Open', 'Closed', 'Draft'];
    $title        = trim($body['title']        ?? '');
    $department   = trim($body['department']   ?? '');
    $description  = trim($body['description']  ?? '');
    $requirements = trim($body['requirements'] ?? '');
    $status       = in_array($body['status'] ?? '', $allowed_statuses) ? $body['status'] : 'Open';

    if (!$title || !$department) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Title and department are required.']);
        exit;
    }

    $stmt = $conn->prepare("
        UPDATE job_posting
        SET title=?, department=?, description=?, requirements=?, status=?
        WHERE id=?
    ");
    $stmt->bind_param('sssssi', $title, $department, $description, $requirements, $status, $id);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();
    $conn->close();

    if ($affected === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Job posting not found.']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Job posting updated.']);
    exit;
}

// ── DELETE — close ────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    requireRole($auth, ['Admin', 'HR']);

    $id = (int)($_GET['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing job posting ID.']);
        exit;
    }

    // Soft delete — mark as Closed, preserve data
    $stmt = $conn->prepare("UPDATE job_posting SET status='Closed' WHERE id=?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();
    $conn->close();

    if ($affected === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Job posting not found.']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Job posting closed.']);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed.']);