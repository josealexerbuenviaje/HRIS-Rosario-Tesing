<?php
// ============================================================
//  get_departments_with_head.php
//  Returns all active departments with nested employees and
//  resolved department head details.
//  — Prepared statements throughout (no SQL injection)
//  — No internal error details leaked to client
//  — Input validated before use
// ============================================================
require_once 'bootstrap.php';
$auth = requireAuth();
// ── Helper: sanitize zero-dates from MySQL ────────────────────────────────────
function safeDate(?string $v): ?string {
    if (!$v || $v === '0000-00-00' || str_starts_with($v, '0000-00-00')) return null;
    return $v;
}

try {

    // ── 1. Fetch all active departments ──────────────────────────────────────
    $deptStmt = $conn->prepare("
        SELECT dept_id, dept_code, dept_name, dept_type,
               office_head, position_title, contact_number, email_address
        FROM   department
        WHERE  status = 'Active'
        ORDER  BY dept_name ASC
    ");
    $deptStmt->execute();
    $deptResult = $deptStmt->get_result();
    $deptStmt->close();

    // ── 2. Prepare reusable statements outside the loop ──────────────────────
    // Employee query for each department
    $empStmt = $conn->prepare("
        SELECT
            e.employee_id,
            e.employee_no,
            CONCAT(
                e.last_name, ', ', e.first_name,
                IF(e.middle_name IS NOT NULL AND e.middle_name != '',
                   CONCAT(' ', LEFT(e.middle_name, 1), '.'), ''),
                IF(e.suffix IS NOT NULL AND e.suffix != '',
                   CONCAT(' ', e.suffix), '')
            )                           AS full_name,
            e.last_name,
            e.first_name,
            e.middle_name,
            e.suffix,
            e.sex,
            CASE WHEN e.birth_date       = '0000-00-00' THEN NULL ELSE e.birth_date       END AS birth_date,
            e.place_of_birth,
            e.civil_status,
            e.citizenship,
            e.height_m,
            e.weight_kg,
            e.blood_type,
            e.contact_number,
            e.email_address,
            e.address_permanent,
            e.address_residential,
            e.tin_no,
            e.sss_no,
            e.gsis_no,
            e.philhealth_no,
            e.pagibig_no,
            e.dept_id,
            d.dept_name,
            d.dept_code,
            e.section_id,
            s.section_name,
            s.section_code,
            e.position_id,
            e.position_title,
            e.salary_grade,
            e.step_increment,
            e.monthly_salary,
            e.appointment_type,
            e.employment_status,
            CASE WHEN e.date_hired       = '0000-00-00' THEN NULL ELSE e.date_hired       END AS date_hired,
            CASE WHEN e.date_regularized = '0000-00-00' THEN NULL ELSE e.date_regularized END AS date_regularized,
            CASE WHEN e.date_separated   = '0000-00-00' THEN NULL ELSE e.date_separated   END AS date_separated,
            e.separation_cause,
            e.remarks,
            e.created_at,
            e.updated_at
        FROM      employee   e
        JOIN      department d ON e.dept_id    = d.dept_id
        LEFT JOIN section    s ON e.section_id = s.section_id
        WHERE e.dept_id = ?
          AND e.employment_status NOT IN ('Separated', 'Retired', 'AWOL', 'Deceased')
        ORDER BY e.last_name ASC
    ");

    // Department head lookup statement
    $headStmt = $conn->prepare("
        SELECT
            employee_id,
            CONCAT(first_name, ' ', last_name) AS full_name,
            position_title,
            email_address,
            contact_number
        FROM  employee
        WHERE dept_id = ?
          AND employment_status NOT IN ('Separated', 'Retired', 'AWOL', 'Deceased')
          AND (
              last_name  LIKE ?
           OR first_name LIKE ?
           OR CONCAT(first_name, ' ', last_name) LIKE ?
          )
        LIMIT 1
    ");

    // ── 3. Loop through departments ───────────────────────────────────────────
    $departments = [];

    while ($dept = $deptResult->fetch_assoc()) {
        $deptId = $dept['dept_id'];

        // ── Employees ────────────────────────────────────────────────────────
        $empStmt->bind_param('s', $deptId);
        $empStmt->execute();
        $empResult = $empStmt->get_result();

        $employees = [];
        while ($emp = $empResult->fetch_assoc()) {
            // Sanitize dates in result
            foreach (['birth_date','date_hired','date_regularized','date_separated'] as $df) {
                $emp[$df] = safeDate($emp[$df]);
            }
            $employees[] = $emp;
        }

        // ── Department head ───────────────────────────────────────────────────
        $head     = null;
        $headName = trim($dept['office_head'] ?? '');

        if ($headName !== '') {
            // Split on spaces/commas to get first token for partial match
            $parts      = preg_split('/[\s,]+/', $headName, 2);
            $firstToken = '%' . ($parts[0] ?? $headName) . '%';
            $fullLike   = '%' . $headName . '%';

            $headStmt->bind_param('ssss', $deptId, $firstToken, $firstToken, $fullLike);
            $headStmt->execute();
            $headResult = $headStmt->get_result();

            if ($headResult->num_rows > 0) {
                $head = $headResult->fetch_assoc();
            }

            // Fallback: use department table fields directly if no employee match
            if (!$head) {
                $head = [
                    "employee_id"    => null,
                    "full_name"      => $dept['office_head'],
                    "position_title" => $dept['position_title'],
                    "email_address"  => $dept['email_address'],
                    "contact_number" => $dept['contact_number'],
                ];
            }
        }

        $departments[] = [
            "dept_id"        => $dept['dept_id'],
            "dept_code"      => $dept['dept_code'],
            "dept_name"      => $dept['dept_name'],
            "dept_type"      => $dept['dept_type'],
            "office_head"    => $dept['office_head'],
            "position_title" => $dept['position_title'],
            "contact_number" => $dept['contact_number'],
            "email_address"  => $dept['email_address'],
            "head"           => $head,
            "employee_count" => count($employees),
            "employees"      => $employees,
        ];
    }

    $empStmt->close();
    $headStmt->close();

    echo json_encode([
        "status" => "success",
        "count"  => count($departments),
        "data"   => $departments,
    ]);

} catch (mysqli_sql_exception $e) {
    // Log full error server-side, never expose to client
    error_log("[get_departments_with_head] DB error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status"  => "error",
        "message" => "An unexpected error occurred. Please try again later.",
    ]);
} finally {
    $conn->close();
}
?>