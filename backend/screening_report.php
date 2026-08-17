<?php
// ============================================================
//  screening_report.php
//  GET  /screening_report.php            — JSON screening summary
//  GET  /screening_report.php?export=csv — download as CSV
// ============================================================
require_once 'bootstrap.php';
$auth = requireAuth();
requireRole($auth, ['Admin', 'HR']);
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

// Optional filters
$conditions = ["a.status = 'Screening'"];
$params     = [];
$types      = '';

if (!empty($_GET['job_posting_id'])) {
    $conditions[] = 'a.job_posting_id = ?';
    $params[]     = (int)$_GET['job_posting_id'];
    $types       .= 'i';
}
if (!empty($_GET['search'])) {
    $conditions[] = "(CONCAT(a.first_name, ' ', a.last_name) LIKE ?)";
    $params[]     = '%' . $_GET['search'] . '%';
    $types       .= 's';
}

$where = 'WHERE ' . implode(' AND ', $conditions);

$sql = "
    SELECT
        a.id,
        CONCAT(a.first_name, ' ', a.last_name) AS name,
        a.email,
        a.phone,
        a.status AS screening_status,
        jp.title       AS position,
        jp.department,
        a.created_at   AS applied_at
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

// ── CSV export ────────────────────────────────────────────────────────────────
if (!empty($_GET['export']) && $_GET['export'] === 'csv') {
    $filename = 'screening_report_' . date('Ymd_His') . '.csv';

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');

    $out = fopen('php://output', 'w');
    fputcsv($out, ['ID', 'Name', 'Email', 'Phone', 'Position', 'Department', 'Status', 'Applied At']);
    foreach ($rows as $row) {
        fputcsv($out, [
            $row['id'],
            $row['name'],
            $row['email'],
            $row['phone'],
            $row['position'],
            $row['department'],
            $row['screening_status'],
            $row['applied_at'],
        ]);
    }
    fclose($out);
    exit;
}

// ── JSON ──────────────────────────────────────────────────────────────────────
echo json_encode([
    'success' => true,
    'total'   => count($rows),
    'data'    => $rows,
]);