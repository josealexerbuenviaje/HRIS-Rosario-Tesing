<?php
require_once 'bootstrap.php';

$body = file_get_contents("php://input");
$data = json_decode($body, true);
if (!is_array($data)) sendError(400, "Invalid or missing JSON payload");

function field(array $data, string $key, bool $required = false): ?string {
    $v = isset($data[$key]) ? trim((string)$data[$key]) : '';
    if ($required && $v === '') return null;
    return $v === '' ? null : $v;
}

// ── Required fields ───────────────────────────────────────────────────────────
$requiredKeys = [
    'lastName','firstName','sex','birthDate','civilStatus',
    'email','department','positionTitle','salaryGrade',
    'monthlySalary','appointmentType','dateHired'
];
$missing = [];
foreach ($requiredKeys as $k) {
    if (field($data, $k, true) === null) $missing[] = $k;
}
if ($missing) sendError(422, "Missing required fields", ["fields" => $missing]);

// ── Validation ────────────────────────────────────────────────────────────────
$errors = [];

$email = filter_var(field($data, 'email'), FILTER_VALIDATE_EMAIL);
if (!$email) $errors[] = "Invalid email address";

$salaryGrade = filter_var($data['salaryGrade'], FILTER_VALIDATE_INT,
                          ['options' => ['min_range' => 1, 'max_range' => 33]]);
if ($salaryGrade === false) $errors[] = "salaryGrade must be between 1 and 33";

$monthlySalary = filter_var($data['monthlySalary'], FILTER_VALIDATE_FLOAT);
if ($monthlySalary === false || $monthlySalary <= 0)
    $errors[] = "monthlySalary must be a positive number";

$stepIncrement = 1;
if (!empty($data['stepIncrement'])) {
    $stepIncrement = filter_var($data['stepIncrement'], FILTER_VALIDATE_INT,
                                ['options' => ['min_range' => 1, 'max_range' => 8]]);
    if ($stepIncrement === false) $errors[] = "stepIncrement must be between 1 and 8";
}

foreach (['birthDate','dateHired'] as $dk) {
    $v = field($data, $dk);
    if ($v && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $v))
        $errors[] = "$dk must be YYYY-MM-DD";
}

if (!in_array(strtolower(field($data,'sex') ?? ''), ['male','female'], true))
    $errors[] = "sex must be Male or Female";

if (!in_array(strtolower(field($data,'civilStatus') ?? ''),
    ['single','married','widowed','separated','divorced'], true))
    $errors[] = "Invalid civilStatus";

if (!in_array(strtolower(field($data,'appointmentType') ?? ''),
    ['permanent','temporary','casual','contractual','coterminous'], true))
    $errors[] = "Invalid appointmentType";

$contactNumber = field($data, 'contactNumber');
if ($contactNumber !== null && !preg_match('/^\+?[\d\s\-]{7,20}$/', $contactNumber))
    $errors[] = "contactNumber format is invalid";

foreach (['tinNo'=>'/^\d{9,12}$/','gsisNo'=>'/^\d{11}$/','philhealthNo'=>'/^\d{12}$/','pagibigNo'=>'/^\d{12}$/'] as $k=>$p) {
    $v = field($data, $k);
    if ($v !== null && !preg_match($p, $v)) $errors[] = "$k format is invalid";
}

if ($errors) sendError(422, "Validation failed", ["errors" => $errors]);

// ── Sanitised values ──────────────────────────────────────────────────────────
$lastName        = field($data, 'lastName');
$firstName       = field($data, 'firstName');
$middleName      = field($data, 'middleName');
$suffix          = field($data, 'suffix');
$sex             = ucfirst(strtolower(field($data, 'sex')));
$birthDate       = field($data, 'birthDate');
$civilStatus     = ucfirst(strtolower(field($data, 'civilStatus')));
$positionTitle   = field($data, 'positionTitle');
$appointmentType = ucfirst(strtolower(field($data, 'appointmentType')));
$dateHired       = field($data, 'dateHired');
$tinNo           = field($data, 'tinNo');
$gsisNo          = field($data, 'gsisNo');
$philhealthNo    = field($data, 'philhealthNo');
$pagibigNo       = field($data, 'pagibigNo');
$deptSearch      = field($data, 'department');
$sectionRaw      = field($data, 'section');  // optional section_id

// ── Transaction ───────────────────────────────────────────────────────────────
$conn->begin_transaction();

try {
    // ── Resolve department ────────────────────────────────────────────────────
    $stmtDept = $conn->prepare("
        SELECT dept_id FROM department
        WHERE (UPPER(dept_code) = UPPER(?)
            OR UPPER(dept_id)   = UPPER(?)
            OR UPPER(dept_name) = UPPER(?))
          AND status = 'Active'
        LIMIT 1
    ");
    if (!$stmtDept) throw new RuntimeException("Prepare failed");
    $stmtDept->bind_param('sss', $deptSearch, $deptSearch, $deptSearch);
    $stmtDept->execute();
    $stmtDept->bind_result($resolvedDeptId);
    if (!$stmtDept->fetch() || !$resolvedDeptId) {
        $stmtDept->close();
        $conn->rollback();
        sendError(422, "Department not found. Please verify the department code or name.");
    }
    $stmtDept->close();

    // ── Resolve section (optional) ────────────────────────────────────────────
    // Must belong to the resolved department and be Active.
    // If invalid or blank — silently set NULL, never block the save.
    $resolvedSectionId = null;
    if ($sectionRaw !== null) {
        $stmtSec = $conn->prepare("
            SELECT section_id FROM section
            WHERE section_id = ?
              AND dept_id    = ?
              AND status     = 'Active'
            LIMIT 1
        ");
        if (!$stmtSec) throw new RuntimeException("Prepare failed");
        $stmtSec->bind_param('ss', $sectionRaw, $resolvedDeptId);
        $stmtSec->execute();
        $stmtSec->bind_result($resolvedSectionId);
        $stmtSec->fetch();
        $stmtSec->close();
    }

    // ── Generate IDs ──────────────────────────────────────────────────────────
    $result = $conn->query("SELECT COUNT(*) FROM employee FOR UPDATE");
    if (!$result) throw new RuntimeException("Count query failed");
    [$count]    = $result->fetch_row();
    $seq        = str_pad((int)$count + 1, 5, '0', STR_PAD_LEFT);
    $year       = date('Y');
    $employeeId = "EMP-{$seq}";
    $employeeNo = "{$year}-{$seq}";

    // ── INSERT ────────────────────────────────────────────────────────────────
    $stmt = $conn->prepare("
        INSERT INTO employee (
            employee_id, employee_no,
            last_name, first_name, middle_name, suffix,
            sex, birth_date, civil_status,
            contact_number, email_address,
            tin_no, gsis_no, philhealth_no, pagibig_no,
            dept_id, section_id, position_title,
            salary_grade, step_increment, monthly_salary,
            appointment_type, employment_status, date_hired
        ) VALUES (
            ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, 'Probationary', ?
        )
    ");
    if (!$stmt) throw new RuntimeException("Prepare failed");

    $stmt->bind_param(
        'ssssssssssssssssssiidss',
        $employeeId,       $employeeNo,
        $lastName,         $firstName,      $middleName,   $suffix,
        $sex,              $birthDate,      $civilStatus,
        $contactNumber,    $email,
        $tinNo,            $gsisNo,         $philhealthNo, $pagibigNo,
        $resolvedDeptId,   $resolvedSectionId, $positionTitle,
        $salaryGrade,      $stepIncrement,  $monthlySalary,
        $appointmentType,  $dateHired
    );

    if (!$stmt->execute()) {
        $errno = $stmt->errno;
        $stmt->close();
        throw new RuntimeException("Insert failed", $errno);
    }
    $stmt->close();
    $conn->commit();

    http_response_code(201);
    echo json_encode([
        "status"      => "success",
        "message"     => "Employee added successfully",
        "employee_id" => $employeeId,
        "employee_no" => $employeeNo,
    ]);

} catch (RuntimeException $e) {
    $conn->rollback();
    if ($e->getCode() === 1062)
        sendError(409, "A record with the same TIN, GSIS, PhilHealth, or email already exists");
    error_log("[add_employee] " . $e->getMessage());
    sendError(500, "An unexpected error occurred. Please try again later.");
} finally {
    $conn->close();
}