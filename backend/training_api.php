<?php
/**
 * training_api.php
 *
 * Backend for the Training module (Courses, Sessions, Enrollments, Certifications, Reports).
 * Uses mysqli (matching db.php's $conn) and mirrors the response shape used by
 * performance_api.php / job_postings.php:
 *   { "status": "success" | "error", "message": "...", "data": [...] }
 *
 * Auth is handled by jwt_helper.php's requireAuth(), which returns the decoded JWT
 * payload as an object ($auth->sub = user id, $auth->role = role) or exits with a
 * 401 JSON error internally if the token is missing/invalid.
 */

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *"); // tighten to your frontend origin in production
header("Access-Control-Allow-Headers: Authorization, Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db.php';           // expects $conn (mysqli instance)
require_once __DIR__ . '/jwt_helper.php';  // expects requireAuth() to return the decoded token or exit 401

$auth = requireAuth();

function respond($status, $message, $data = null) {
    echo json_encode([
        "status"  => $status,
        "message" => $message,
        "data"    => $data,
    ]);
    exit;
}

function bodyJson() {
    $raw = file_get_contents("php://input");
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

/**
 * Run a prepared SELECT and return all rows as an assoc array.
 * $types is the mysqli bind_param type string (e.g. "si"), $params the values.
 */
function fetchAll(mysqli $conn, string $sql, string $types = "", array $params = []) {
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $conn->error);
    }
    if ($types !== "") {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $rows = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    return $rows;
}

/**
 * Run a prepared INSERT/UPDATE/DELETE. Returns the mysqli_stmt so callers can
 * check errno / affected_rows / insert_id before closing.
 */
function runStmt(mysqli $conn, string $sql, string $types = "", array $params = []) {
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $conn->error);
    }
    if ($types !== "") {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    return $stmt;
}

$action = $_GET['action'] ?? '';

try {
    switch ($action) {

        // ─────────────────────────────────────────────────────
        // Employees (dropdown source)
        // ─────────────────────────────────────────────────────
        case 'get_employees':
            $rows = fetchAll($conn, "
                SELECT employee_id,
                       CONCAT(last_name, ', ', first_name,
                              IF(middle_name IS NOT NULL AND middle_name != '', CONCAT(' ', middle_name), '')
                       ) AS full_name
                FROM employee
                ORDER BY last_name ASC, first_name ASC
            ");
            respond("success", "Employees retrieved.", $rows);
            break;

        // ─────────────────────────────────────────────────────
        // Courses
        // ─────────────────────────────────────────────────────
        case 'get_courses':
            $search = '%' . ($_GET['search'] ?? '') . '%';
            $rows = fetchAll($conn, "
                SELECT course_id, title, description, category, duration_hours
                FROM training_courses
                WHERE title LIKE ? OR category LIKE ?
                ORDER BY created_at DESC
            ", "ss", [$search, $search]);
            respond("success", "Courses retrieved.", $rows);
            break;

        case 'add_course':
            $b = bodyJson();
            if (empty($b['title'])) {
                respond("error", "Course title is required.");
            }
            $duration = ($b['duration_hours'] ?? '') !== '' ? (float)$b['duration_hours'] : null;
            runStmt($conn, "
                INSERT INTO training_courses (title, description, category, duration_hours)
                VALUES (?, ?, ?, ?)
            ", "sssd", [
                $b['title'],
                $b['description'] ?? null,
                $b['category'] ?? null,
                $duration,
            ]);
            respond("success", "Course added successfully.");
            break;

        case 'delete_course':
            $b = bodyJson();
            if (empty($b['course_id'])) {
                respond("error", "course_id is required.");
            }
            runStmt($conn, "DELETE FROM training_courses WHERE course_id = ?", "i", [$b['course_id']]);
            respond("success", "Course deleted.");
            break;

        // ─────────────────────────────────────────────────────
        // Sessions
        // ─────────────────────────────────────────────────────
        case 'get_sessions':
            $search = '%' . ($_GET['search'] ?? '') . '%';
            $rows = fetchAll($conn, "
                SELECT s.session_id, s.course_id, c.title AS course_title,
                       s.session_date, s.location, s.trainer, s.capacity
                FROM training_sessions s
                JOIN training_courses c ON c.course_id = s.course_id
                WHERE c.title LIKE ? OR s.location LIKE ? OR s.trainer LIKE ?
                ORDER BY s.session_date ASC
            ", "sss", [$search, $search, $search]);
            respond("success", "Sessions retrieved.", $rows);
            break;

        case 'add_session':
            $b = bodyJson();
            if (empty($b['course_id']) || empty($b['session_date'])) {
                respond("error", "course_id and session_date are required.");
            }
            $capacity = ($b['capacity'] ?? '') !== '' ? (int)$b['capacity'] : null;
            runStmt($conn, "
                INSERT INTO training_sessions (course_id, session_date, location, trainer, capacity)
                VALUES (?, ?, ?, ?, ?)
            ", "isssi", [
                $b['course_id'],
                $b['session_date'],
                $b['location'] ?? null,
                $b['trainer'] ?? null,
                $capacity,
            ]);
            respond("success", "Session scheduled successfully.");
            break;

        case 'delete_session':
            $b = bodyJson();
            if (empty($b['session_id'])) {
                respond("error", "session_id is required.");
            }
            runStmt($conn, "DELETE FROM training_sessions WHERE session_id = ?", "i", [$b['session_id']]);
            respond("success", "Session deleted.");
            break;

        // ─────────────────────────────────────────────────────
        // Enrollments
        // ─────────────────────────────────────────────────────
        case 'get_enrollments':
            $search = '%' . ($_GET['search'] ?? '') . '%';
            $rows = fetchAll($conn, "
                SELECT en.enrollment_id, en.employee_id,
                       CONCAT(e.last_name, ', ', e.first_name) AS employee_name,
                       en.session_id, c.title AS course_title, s.session_date, en.status
                FROM training_enrollments en
                JOIN employee e          ON e.employee_id = en.employee_id
                JOIN training_sessions s ON s.session_id = en.session_id
                JOIN training_courses c  ON c.course_id = s.course_id
                WHERE CONCAT(e.last_name, ', ', e.first_name) LIKE ? OR c.title LIKE ?
                ORDER BY en.enrolled_at DESC
            ", "ss", [$search, $search]);
            respond("success", "Enrollments retrieved.", $rows);
            break;

        case 'add_enrollment':
            $b = bodyJson();
            if (empty($b['employee_id']) || empty($b['session_id'])) {
                respond("error", "employee_id and session_id are required.");
            }
            $stmt = $conn->prepare("
                INSERT INTO training_enrollments (employee_id, session_id, status)
                VALUES (?, ?, 'Enrolled')
            ");
            $employeeId = $b['employee_id'];
            $sessionId  = $b['session_id'];
            $stmt->bind_param("si", $employeeId, $sessionId);
            $stmt->execute();
            if ($stmt->errno) {
                if ($stmt->errno === 1062) { // duplicate key
                    respond("error", "This employee is already enrolled in that session.");
                }
                throw new Exception($stmt->error);
            }
            respond("success", "Employee enrolled successfully.");
            break;

        case 'update_enrollment_status':
            $b = bodyJson();
            if (empty($b['enrollment_id']) || empty($b['status'])) {
                respond("error", "enrollment_id and status are required.");
            }
            $allowed = ['Enrolled', 'In Progress', 'Completed', 'Cancelled'];
            if (!in_array($b['status'], $allowed, true)) {
                respond("error", "Invalid status value.");
            }
            $completedAt = $b['status'] === 'Completed' ? date('Y-m-d H:i:s') : null;
            runStmt($conn, "
                UPDATE training_enrollments
                SET status = ?, completed_at = ?
                WHERE enrollment_id = ?
            ", "ssi", [$b['status'], $completedAt, $b['enrollment_id']]);
            respond("success", "Enrollment status updated.");
            break;

        case 'delete_enrollment':
            $b = bodyJson();
            if (empty($b['enrollment_id'])) {
                respond("error", "enrollment_id is required.");
            }
            runStmt($conn, "DELETE FROM training_enrollments WHERE enrollment_id = ?", "i", [$b['enrollment_id']]);
            respond("success", "Enrollment deleted.");
            break;

        // ─────────────────────────────────────────────────────
        // Certifications
        // ─────────────────────────────────────────────────────
        case 'get_certifications':
            $search = '%' . ($_GET['search'] ?? '') . '%';
            $rows = fetchAll($conn, "
                SELECT cert.certification_id, cert.employee_id,
                       CONCAT(e.last_name, ', ', e.first_name) AS employee_name,
                       cert.certification_name, cert.issuing_body,
                       cert.issued_date, cert.expiry_date
                FROM training_certifications cert
                JOIN employee e ON e.employee_id = cert.employee_id
                WHERE CONCAT(e.last_name, ', ', e.first_name) LIKE ?
                   OR cert.certification_name LIKE ?
                   OR cert.issuing_body LIKE ?
                ORDER BY cert.created_at DESC
            ", "sss", [$search, $search, $search]);
            respond("success", "Certifications retrieved.", $rows);
            break;

        case 'add_certification':
            $b = bodyJson();
            if (empty($b['employee_id']) || empty($b['certification_name'])) {
                respond("error", "employee_id and certification_name are required.");
            }
            $issuedDate = ($b['issued_date'] ?? '') !== '' ? $b['issued_date'] : null;
            $expiryDate = ($b['expiry_date'] ?? '') !== '' ? $b['expiry_date'] : null;
            runStmt($conn, "
                INSERT INTO training_certifications
                    (employee_id, certification_name, issuing_body, issued_date, expiry_date)
                VALUES (?, ?, ?, ?, ?)
            ", "sssss", [
                $b['employee_id'],
                $b['certification_name'],
                $b['issuing_body'] ?? null,
                $issuedDate,
                $expiryDate,
            ]);
            respond("success", "Certification added successfully.");
            break;

        case 'delete_certification':
            $b = bodyJson();
            if (empty($b['certification_id'])) {
                respond("error", "certification_id is required.");
            }
            runStmt($conn, "DELETE FROM training_certifications WHERE certification_id = ?", "i", [$b['certification_id']]);
            respond("success", "Certification deleted.");
            break;

        // ─────────────────────────────────────────────────────
        // Reports (CSV export)
        // ─────────────────────────────────────────────────────
        case 'generate_report':
            $type = $_GET['type'] ?? 'course_completion';
            $from = ($_GET['from'] ?? '') !== '' ? $_GET['from'] : null;
            $to   = ($_GET['to'] ?? '') !== '' ? $_GET['to'] : null;

            // NULL-safe range filter: matches all rows when $from/$to are null
            if ($type === 'course_completion') {
                $sql = "
                    SELECT CONCAT(e.last_name, ', ', e.first_name) AS employee,
                           c.title AS course,
                           s.session_date, en.status, en.completed_at
                    FROM training_enrollments en
                    JOIN employee e          ON e.employee_id = en.employee_id
                    JOIN training_sessions s ON s.session_id = en.session_id
                    JOIN training_courses c  ON c.course_id = s.course_id
                    WHERE (? IS NULL OR s.session_date >= ?)
                      AND (? IS NULL OR s.session_date <= ?)
                    ORDER BY s.session_date ASC
                ";
                $columns = ['Employee', 'Course', 'Session Date', 'Status', 'Completed At'];
                $types = "ssss";
                $params = [$from, $from, $to, $to];
            } elseif ($type === 'certification_status') {
                $sql = "
                    SELECT CONCAT(e.last_name, ', ', e.first_name) AS employee,
                           cert.certification_name,
                           cert.issuing_body, cert.issued_date, cert.expiry_date
                    FROM training_certifications cert
                    JOIN employee e ON e.employee_id = cert.employee_id
                    WHERE (? IS NULL OR cert.issued_date >= ?)
                      AND (? IS NULL OR cert.issued_date <= ?)
                    ORDER BY cert.issued_date ASC
                ";
                $columns = ['Employee', 'Certification', 'Issuing Body', 'Issued Date', 'Expiry Date'];
                $types = "ssss";
                $params = [$from, $from, $to, $to];
            } else {
                respond("error", "Unknown report type.");
            }

            $rows = fetchAll($conn, $sql, $types, $params);

            header("Content-Type: text/csv");
            header("Content-Disposition: attachment; filename=\"training_{$type}_{$from}_to_{$to}.csv\"");

            $out = fopen("php://output", "w");
            fputcsv($out, $columns);
            foreach ($rows as $row) {
                fputcsv($out, $row);
            }
            fclose($out);
            exit;

        default:
            http_response_code(400);
            respond("error", "Unknown action: {$action}");
    }
} catch (mysqli_sql_exception $e) {
    error_log("training_api.php DB error: " . $e->getMessage());
    http_response_code(500);
    respond("error", "A database error occurred.");
} catch (Throwable $e) {
    error_log("training_api.php error: " . $e->getMessage());
    http_response_code(500);
    respond("error", "An unexpected error occurred.");
}