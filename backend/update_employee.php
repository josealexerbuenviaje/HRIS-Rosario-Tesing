<?php
// ============================================================
//  update_employee.php  —  Updates ALL employee table columns
//  — Prepared statements throughout (no SQL injection)
//  — Input validation with whitelist for enums
//  — Transaction for atomicity
//  — No internal error details leaked to client
//  — try/catch/finally for clean error handling
// ============================================================

require_once 'cors.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
    exit;
}

require_once 'db.php';

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// ── Parse body ────────────────────────────────────────────────────────────────
$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data) || empty($data['employee_id'])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Missing or invalid employee_id"]);
    exit;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// Trim and return null if blank
function opt(?string $v): ?string {
    $v = trim($v ?? '');
    return $v === '' ? null : $v;
}
// Trim and return null if blank — alias for required-ish fields
function req(?string $v): ?string { return opt($v); }

// Sanitize date — null if empty or zero-date
function safeDate(?string $v): ?string {
    $v = trim($v ?? '');
    if ($v === '' || $v === '0000-00-00' || str_starts_with($v, '0000-00-00')) return null;
    return $v;
}

// Validate against a whitelist of allowed values
function allowedVal(?string $v, array $list): ?string {
    if ($v === null) return null;
    return in_array($v, $list, true) ? $v : null;
}

// ── Whitelist enums ───────────────────────────────────────────────────────────
$VALID_SEX         = ['Male', 'Female'];
$VALID_CIVIL       = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced'];
$VALID_APPOINTMENT = ['Permanent', 'Temporary', 'Casual', 'Contractual', 'Co-terminus',
                      'Elective', 'Career Executive Service'];
$VALID_EMP_STATUS  = ['Probationary', 'Permanent', 'Casual', 'Separated',
                      'Retired', 'AWOL', 'Deceased'];

// ── Validate required fields ──────────────────────────────────────────────────
$errors = [];

$employeeId = opt($data['employee_id'] ?? '');
if (!$employeeId) $errors[] = "employee_id is required";

$lastName  = req($data['last_name']  ?? '');
$firstName = req($data['first_name'] ?? '');
if (!$lastName)  $errors[] = "last_name is required";
if (!$firstName) $errors[] = "first_name is required";

$email = opt($data['email_address'] ?? '');
if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL))
    $errors[] = "Invalid email address";

$salaryGrade = isset($data['salary_grade']) && $data['salary_grade'] !== ''
    ? filter_var($data['salary_grade'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 33]])
    : null;
if (isset($data['salary_grade']) && $data['salary_grade'] !== '' && $salaryGrade === false)
    $errors[] = "salary_grade must be between 1 and 33";

$stepIncrement = isset($data['step_increment']) && $data['step_increment'] !== ''
    ? filter_var($data['step_increment'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 8]])
    : null;
if (isset($data['step_increment']) && $data['step_increment'] !== '' && $stepIncrement === false)
    $errors[] = "step_increment must be between 1 and 8";

$monthlySalary = isset($data['monthly_salary']) && $data['monthly_salary'] !== ''
    ? filter_var($data['monthly_salary'], FILTER_VALIDATE_FLOAT)
    : null;
if (isset($data['monthly_salary']) && $data['monthly_salary'] !== '' && $monthlySalary === false)
    $errors[] = "monthly_salary must be a valid number";

$heightM  = isset($data['height_m'])  && $data['height_m']  !== '' ? filter_var($data['height_m'],  FILTER_VALIDATE_FLOAT) : null;
$weightKg = isset($data['weight_kg']) && $data['weight_kg'] !== '' ? filter_var($data['weight_kg'], FILTER_VALIDATE_FLOAT) : null;

if ($errors) {
    http_response_code(422);
    echo json_encode(["status" => "error", "message" => "Validation failed", "errors" => $errors]);
    exit;
}

// ── Sanitize all scalar fields ────────────────────────────────────────────────
$middleName      = opt($data['middle_name']       ?? '');
$suffix          = opt($data['suffix']            ?? '');
$sex             = allowedVal(opt($data['sex']    ?? ''), $VALID_SEX);
$birthDate       = safeDate($data['birth_date']   ?? '');
$placeOfBirth    = opt($data['place_of_birth']    ?? '');
$civilStatus     = allowedVal(opt($data['civil_status'] ?? ''), $VALID_CIVIL);
$citizenship     = opt($data['citizenship']       ?? '');
$bloodType       = opt($data['blood_type']        ?? '');
$contactNumber   = opt($data['contact_number']    ?? '');
$addrPermanent   = opt($data['address_permanent'] ?? '');
$addrResidential = opt($data['address_residential'] ?? '');
$tinNo           = opt($data['tin_no']            ?? '');
$sssNo           = opt($data['sss_no']            ?? '');
$gsisNo          = opt($data['gsis_no']           ?? '');
$philhealthNo    = opt($data['philhealth_no']      ?? '');
$pagibigNo       = opt($data['pagibig_no']        ?? '');
$positionTitle   = opt($data['position_title']    ?? '');
$appointmentType = allowedVal(opt($data['appointment_type']  ?? ''), $VALID_APPOINTMENT);
$empStatus       = allowedVal(opt($data['employment_status'] ?? ''), $VALID_EMP_STATUS);
$dateHired       = safeDate($data['date_hired']        ?? '');
$dateRegularized = safeDate($data['date_regularized']  ?? '');
$dateSeparated   = safeDate($data['date_separated']    ?? '');
$separationCause = opt($data['separation_cause']  ?? '');
$remarks         = opt($data['remarks']           ?? '');
$employeeNo      = opt($data['employee_no']       ?? '');
$deptRaw         = opt($data['dept_id']           ?? '');
$sectionRaw      = opt($data['section_id']        ?? '');

try {
    $conn->begin_transaction();

    // ── Verify employee exists ────────────────────────────────────────────────
    $chkStmt = $conn->prepare("SELECT employee_id FROM employee WHERE employee_id = ? LIMIT 1");
    $chkStmt->bind_param('s', $employeeId);
    $chkStmt->execute();
    if ($chkStmt->get_result()->num_rows === 0) {
        $chkStmt->close();
        $conn->rollback();
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Employee not found"]);
        exit;
    }
    $chkStmt->close();

    // ── Resolve dept_id ───────────────────────────────────────────────────────
    $resolvedDeptId = null;
    if ($deptRaw !== null) {
        $dStmt = $conn->prepare("
            SELECT dept_id FROM department
            WHERE (UPPER(dept_id) = UPPER(?) OR UPPER(dept_code) = UPPER(?))
              AND status = 'Active'
            LIMIT 1
        ");
        $dStmt->bind_param('ss', $deptRaw, $deptRaw);
        $dStmt->execute();
        $dRes = $dStmt->get_result();
        if ($dRes->num_rows > 0) {
            $resolvedDeptId = $dRes->fetch_assoc()['dept_id'];
        }
        $dStmt->close();
    }

    // ── Resolve section_id (optional) ────────────────────────────────────────
    // Validates section belongs to the resolved (or current) department.
    // Blank or invalid → NULL (clears section assignment).
    $resolvedSectionId = null;
    if ($sectionRaw !== null) {
        if ($resolvedDeptId !== null) {
            // Validate against the new department
            $sStmt = $conn->prepare("
                SELECT section_id FROM section
                WHERE section_id = ? AND dept_id = ? AND status = 'Active'
                LIMIT 1
            ");
            $sStmt->bind_param('ss', $sectionRaw, $resolvedDeptId);
        } else {
            // Validate against the employee's current department
            $sStmt = $conn->prepare("
                SELECT s.section_id FROM section s
                JOIN employee e ON s.dept_id = e.dept_id
                WHERE s.section_id  = ?
                  AND e.employee_id = ?
                  AND s.status      = 'Active'
                LIMIT 1
            ");
            $sStmt->bind_param('ss', $sectionRaw, $employeeId);
        }
        $sStmt->execute();
        $sRes = $sStmt->get_result();
        if ($sRes->num_rows > 0) {
            $resolvedSectionId = $sRes->fetch_assoc()['section_id'];
        }
        $sStmt->close();
    }

    // ── Build UPDATE with prepared statement ──────────────────────────────────
    // dept_id is optional — only include it in SET if it was provided and resolved
    $deptSql = $resolvedDeptId !== null ? "dept_id = ?," : "";

    $sql = "
        UPDATE employee SET
            $deptSql
            section_id          = ?,
            employee_no         = ?,
            last_name           = ?,
            first_name          = ?,
            middle_name         = ?,
            suffix              = ?,
            sex                 = ?,
            birth_date          = ?,
            place_of_birth      = ?,
            civil_status        = ?,
            citizenship         = ?,
            height_m            = ?,
            weight_kg           = ?,
            blood_type          = ?,
            contact_number      = ?,
            email_address       = ?,
            address_permanent   = ?,
            address_residential = ?,
            tin_no              = ?,
            sss_no              = ?,
            gsis_no             = ?,
            philhealth_no       = ?,
            pagibig_no          = ?,
            position_title      = ?,
            appointment_type    = ?,
            employment_status   = ?,
            salary_grade        = ?,
            step_increment      = ?,
            monthly_salary      = ?,
            date_hired          = ?,
            date_regularized    = ?,
            date_separated      = ?,
            separation_cause    = ?,
            remarks             = ?
        WHERE employee_id = ?
    ";

    $updStmt = $conn->prepare($sql);

    // Pass all numerics as strings — mysqli handles NULL-safe casting cleanly this way
    // Type key: s=string for everything (nulls pass fine), actual numeric conversion
    // happens in MySQL. This avoids bind_param crash on null int/float params.

    if ($resolvedDeptId !== null) {
        // 36 params: dept_id(s) + section_id(s) + 33 fields(s each) + employee_id(s)
        $updStmt->bind_param(
            'ssssssssssssssssssssssssssssssssssss',
            $resolvedDeptId,
            $resolvedSectionId,  $employeeNo,
            $lastName,           $firstName,       $middleName,      $suffix,
            $sex,                $birthDate,       $placeOfBirth,    $civilStatus,
            $citizenship,        $heightM,         $weightKg,        $bloodType,
            $contactNumber,      $email,
            $addrPermanent,      $addrResidential,
            $tinNo,              $sssNo,           $gsisNo,          $philhealthNo,  $pagibigNo,
            $positionTitle,      $appointmentType, $empStatus,
            $salaryGrade,        $stepIncrement,   $monthlySalary,
            $dateHired,          $dateRegularized, $dateSeparated,
            $separationCause,    $remarks,
            $employeeId
        );
    } else {
        // 35 params: section_id(s) + 33 fields(s each) + employee_id(s)
        $updStmt->bind_param(
            'sssssssssssssssssssssssssssssssssss',
            $resolvedSectionId,  $employeeNo,
            $lastName,           $firstName,       $middleName,      $suffix,
            $sex,                $birthDate,       $placeOfBirth,    $civilStatus,
            $citizenship,        $heightM,         $weightKg,        $bloodType,
            $contactNumber,      $email,
            $addrPermanent,      $addrResidential,
            $tinNo,              $sssNo,           $gsisNo,          $philhealthNo,  $pagibigNo,
            $positionTitle,      $appointmentType, $empStatus,
            $salaryGrade,        $stepIncrement,   $monthlySalary,
            $dateHired,          $dateRegularized, $dateSeparated,
            $separationCause,    $remarks,
            $employeeId
        );
    }

    $updStmt->execute();
    $affected = $updStmt->affected_rows;
    $updStmt->close();

    $conn->commit();

    http_response_code(200);
    echo json_encode([
        "status"        => "success",
        "message"       => "Employee updated successfully",
        "employee_id"   => $employeeId,
        "rows_affected" => $affected,
    ]);

} catch (mysqli_sql_exception $e) {
    $conn->rollback();

    // Duplicate entry — safe to surface which field
    if ($e->getCode() === 1062) {
        $err = $e->getMessage();
        $msg = "Duplicate value — ";
        if      (str_contains($err, 'tin_no'))      $msg .= "TIN number already exists.";
        elseif  (str_contains($err, 'gsis_no'))     $msg .= "GSIS number already exists.";
        elseif  (str_contains($err, 'philhealth'))  $msg .= "PhilHealth number already exists.";
        elseif  (str_contains($err, 'sss_no'))      $msg .= "SSS number already exists.";
        elseif  (str_contains($err, 'employee_no')) $msg .= "Employee number already exists.";
        else                                         $msg .= "A unique field already exists for another employee.";
        http_response_code(409);
        echo json_encode(["status" => "error", "message" => $msg]);
    } else {
        // Log full error server-side, never expose to client
        error_log("[update_employee] DB error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "An unexpected error occurred. Please try again later."]);
    }
} finally {
    $conn->close();
}
?>