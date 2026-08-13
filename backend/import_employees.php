<?php
// ============================================================
//  import_employees.php  —  Bulk-inserts employees from JSON
//  — Prepared statements (no SQL injection)
//  — Input validation + enum whitelisting
//  — Transaction for atomicity
//  — No internal error details leaked to client
//  — try/catch/finally for clean error handling
// ============================================================
require_once 'bootstrap.php';



// ── Parse body ────────────────────────────────────────────────────────────────
$rows = json_decode(file_get_contents("php://input"), true);

if (!is_array($rows) || count($rows) === 0) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "No data received or invalid format"]);
    exit;
}

// ── Enum whitelists ───────────────────────────────────────────────────────────
const VALID_SEX         = ['Male', 'Female'];
const VALID_CIVIL       = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced'];
const VALID_APPOINTMENT = ['Permanent', 'Temporary', 'Casual', 'Contractual', 'Co-terminus',
                           'Elective', 'Career Executive Service'];
const VALID_EMP_STATUS  = ['Probationary', 'Permanent', 'Casual', 'Separated',
                           'Retired', 'AWOL', 'Deceased'];

// ── Helpers ───────────────────────────────────────────────────────────────────
// Normalize a string for fuzzy matching (lowercase, alphanumeric only)
function norm(string $s): string {
    return preg_replace('/[^a-z0-9]+/', '', strtolower(trim($s)));
}

// Trim + null-if-blank
function opt($v): ?string {
    $v = trim((string)($v ?? ''));
    return $v === '' ? null : $v;
}

// Sanitize date — null if empty or zero-date
function safeDate($v): ?string {
    $v = trim((string)($v ?? ''));
    if ($v === '' || $v === '0000-00-00' || str_starts_with($v, '0000-00-00')) return null;
    return $v;
}

// Match value against whitelist (case-insensitive) — return canonical or null
function matchEnum(?string $v, array $list): ?string {
    if ($v === null) return null;
    foreach ($list as $item) {
        if (strcasecmp(trim($v), $item) === 0) return $item;
    }
    return null;
}

// ── Column mapping: Excel header → internal key ───────────────────────────────
function mapRow(array $row): array {
    $rowLower = [];
    foreach ($row as $k => $v) {
        $rowLower[norm($k)] = trim((string)$v);
    }

    $map = [
        'last_name'           => ['last_name','lastname'],
        'first_name'          => ['first_name','firstname'],
        'middle_name'         => ['middle_name','middlename'],
        'suffix'              => ['suffix'],
        'sex'                 => ['sex','gender'],
        'birth_date'          => ['birth_date','birthdate','birthday'],
        'place_of_birth'      => ['place_of_birth','placeofbirth','birthplace'],
        'civil_status'        => ['civil_status','civilstatus','maritalstatus'],
        'citizenship'         => ['citizenship'],
        'height_m'            => ['height_m','heightm','heightm','height'],
        'weight_kg'           => ['weight_kg','weightkg','weightkg','weight'],
        'blood_type'          => ['blood_type','bloodtype','blood'],
        'contact_number'      => ['contact_number','contactnumber','phone','mobilenumber','contactno'],
        'email_address'       => ['email_address','emailaddress','email'],
        'address_permanent'   => ['address_permanent','addresspermanent','permanentaddress'],
        'address_residential' => ['address_residential','addressresidential','residentialaddress','address'],
        'tin_no'              => ['tin_no','tinno','tin'],
        'sss_no'              => ['sss_no','sssno','sss'],
        'gsis_no'             => ['gsis_no','gsisno','gsis'],
        'philhealth_no'       => ['philhealth_no','philhealthno','philhealth'],
        'pagibig_no'          => ['pagibig_no','pagibigno','pagibig','hdmf'],
        'dept_code'           => ['dept_code','deptcode','department','dept','departmentcode',
                                  'dept_id','deptid','officecode','office','division',
                                  'department_code','dept_name','departmentname','deptname'],
        'section_code'        => ['section_code','sectioncode','section','branch',
                                  'subdeptcode','subdepartment','sub_department',
                                  'sub_dept','subdept','branchcode'],
        'position_title'      => ['position_title','positiontitle','position','jobtitle'],
        'salary_grade'        => ['salary_grade','salarygrade','sg','grade'],
        'step_increment'      => ['step_increment','stepincrement','step'],
        'monthly_salary'      => ['monthly_salary','monthlysalary','salary','basicpay'],
        'appointment_type'    => ['appointment_type','appointmenttype','appointment','nature'],
        'employment_status'   => ['employment_status','employmentstatus','status'],
        'date_hired'          => ['date_hired','datehired','hiredate','dateofhiring','startdate'],
        'date_regularized'    => ['date_regularized','dateregularized','regularizationdate'],
        'date_separated'      => ['date_separated','dateseparated','separationdate'],
        'separation_cause'    => ['separation_cause','separationcause','reasonforseparation'],
        'remarks'             => ['remarks','notes','comment','comments'],
    ];

    $mapped = [];
    foreach ($map as $key => $aliases) {
        foreach ($aliases as $alias) {
            if (isset($rowLower[norm($alias)]) && $rowLower[norm($alias)] !== '') {
                $mapped[$key] = $rowLower[norm($alias)];
                break;
            }
        }
        if (!isset($mapped[$key])) $mapped[$key] = null;
    }
    return $mapped;
}

try {
    // ── Pre-load dept lookup ──────────────────────────────────────────────────
    $deptMap = [];
    $dStmt   = $conn->prepare("SELECT dept_id, dept_code, dept_name FROM department WHERE status = 'Active'");
    $dStmt->execute();
    $dRes = $dStmt->get_result();
    while ($d = $dRes->fetch_assoc()) {
        $deptMap[strtoupper($d['dept_code'])] = $d;
        $deptMap[strtoupper($d['dept_id'])]   = $d;
        $deptMap[strtoupper($d['dept_name'])] = $d;
    }
    $dStmt->close();

    // ── Pre-load section lookup ───────────────────────────────────────────────
    $sectionMap = [];
    $sStmt      = $conn->prepare("SELECT section_id, section_code, section_name, dept_id FROM section WHERE status = 'Active'");
    $sStmt->execute();
    $sRes = $sStmt->get_result();
    while ($s = $sRes->fetch_assoc()) {
        $sectionMap[strtoupper($s['section_code'])] = $s;
        $sectionMap[strtoupper($s['section_id'])]   = $s;
        $sectionMap[strtoupper($s['section_name'])] = $s;
    }
    $sStmt->close();

    // ── Get starting sequence ─────────────────────────────────────────────────
    $cntStmt = $conn->prepare("SELECT COUNT(*) AS cnt FROM employee");
    $cntStmt->execute();
    $startSeq = (int)$cntStmt->get_result()->fetch_assoc()['cnt'];
    $cntStmt->close();
    $year = date('Y');

    // ── Prepare INSERT statement once ─────────────────────────────────────────
    $insStmt = $conn->prepare("
        INSERT INTO employee (
            employee_id, employee_no,
            last_name, first_name, middle_name, suffix,
            sex, birth_date, place_of_birth,
            civil_status, citizenship,
            height_m, weight_kg, blood_type,
            contact_number, email_address,
            address_permanent, address_residential,
            tin_no, sss_no, gsis_no, philhealth_no, pagibig_no,
            dept_id, section_id, position_title,
            salary_grade, step_increment, monthly_salary,
            appointment_type, employment_status,
            date_hired, date_regularized, date_separated,
            separation_cause, remarks
        ) VALUES (
            ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?
        )
    ");

    // ── Process rows ──────────────────────────────────────────────────────────
    $inserted = 0;
    $skipped  = [];

    $conn->begin_transaction();

    foreach ($rows as $index => $rawRow) {
        $rowNum = $index + 2;
        $r      = mapRow($rawRow);

        // ── Required field check ──────────────────────────────────────────────
        $required = ['last_name','first_name','sex','birth_date','civil_status',
                     'email_address','position_title','salary_grade',
                     'monthly_salary','appointment_type','date_hired'];
        $missing = array_filter($required, fn($f) => empty($r[$f]));
        if ($missing) {
            $hint = $index === 0
                ? " | Your file headers: [" . implode(', ', array_keys($rawRow)) . "]"
                : "";
            $skipped[] = ["row" => $rowNum, "reason" => "Missing required fields: " . implode(', ', $missing) . $hint];
            continue;
        }

        // ── Validate email ────────────────────────────────────────────────────
        if (!filter_var($r['email_address'], FILTER_VALIDATE_EMAIL)) {
            $skipped[] = ["row" => $rowNum, "reason" => "Invalid email: {$r['email_address']}"];
            continue;
        }

        // ── Validate salary grade ─────────────────────────────────────────────
        $sg = filter_var($r['salary_grade'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 33]]);
        if ($sg === false) {
            $skipped[] = ["row" => $rowNum, "reason" => "Invalid salary grade: {$r['salary_grade']} (must be 1–33)"];
            continue;
        }

        // ── Validate step increment ───────────────────────────────────────────
        $step = !empty($r['step_increment'])
            ? filter_var($r['step_increment'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 8]])
            : 1;
        if ($step === false) $step = 1;

        // ── Validate monthly salary ───────────────────────────────────────────
        $salary = filter_var($r['monthly_salary'], FILTER_VALIDATE_FLOAT);
        if ($salary === false || $salary <= 0) {
            $skipped[] = ["row" => $rowNum, "reason" => "Invalid monthly salary: {$r['monthly_salary']}"];
            continue;
        }

        // ── Whitelist enums (invalid → null, row still saves) ─────────────────
        $sex             = matchEnum($r['sex'],              VALID_SEX);
        $civilStatus     = matchEnum($r['civil_status'],     VALID_CIVIL);
        $appointmentType = matchEnum($r['appointment_type'], VALID_APPOINTMENT);
        $empStatus       = matchEnum($r['employment_status'],VALID_EMP_STATUS) ?? 'Probationary';

        // ── Resolve department ────────────────────────────────────────────────
        $resolvedDept = null;
        if (!empty($r['dept_code'])) {
            $deptKey = strtoupper(trim($r['dept_code']));
            if (isset($deptMap[$deptKey])) {
                $resolvedDept = $deptMap[$deptKey];
            } else {
                // Fuzzy fallback
                foreach ($deptMap as $k => $v) {
                    if (norm($k) === norm($r['dept_code'])) { $resolvedDept = $v; break; }
                }
            }
        }
        // Last resort: scan raw cell values
        if (!$resolvedDept) {
            foreach ($rawRow as $colVal) {
                $nv = norm((string)$colVal);
                if (!$nv) continue;
                foreach ($deptMap as $k => $v) {
                    if (norm($k) === $nv) { $resolvedDept = $v; break 2; }
                }
            }
        }
        if (!$resolvedDept) {
            $skipped[] = [
                "row"    => $rowNum,
                "reason" => "Department not found: '" . ($r['dept_code'] ?? '') . "'",
            ];
            continue;
        }
        $resolvedDeptId = $resolvedDept['dept_id'];

        // ── Resolve section (optional) ────────────────────────────────────────
        $resolvedSectionId = null;
        if (!empty($r['section_code'])) {
            $secKey = strtoupper(trim($r['section_code']));
            if (isset($sectionMap[$secKey]) && $sectionMap[$secKey]['dept_id'] === $resolvedDeptId) {
                $resolvedSectionId = $sectionMap[$secKey]['section_id'];
            } else {
                foreach ($sectionMap as $k => $v) {
                    if (norm($k) === norm($r['section_code']) && $v['dept_id'] === $resolvedDeptId) {
                        $resolvedSectionId = $v['section_id'];
                        break;
                    }
                }
            }
            // If unmatched — silently null, never skip the row
        }

        // ── Generate IDs ──────────────────────────────────────────────────────
        $seq        = str_pad($startSeq + $inserted + 1, 5, '0', STR_PAD_LEFT);
        $employeeId = "EMP-{$seq}";
        $employeeNo = "{$year}-{$seq}";

        // ── Sanitize all values ───────────────────────────────────────────────
        $heightM  = is_numeric($r['height_m'])  ? (float)$r['height_m']  : null;
        $weightKg = is_numeric($r['weight_kg']) ? (float)$r['weight_kg'] : null;
        $citizenship = opt($r['citizenship']) ?? 'Filipino';

        $lastName        = opt($r['last_name']);
        $firstName       = opt($r['first_name']);
        $middleName      = opt($r['middle_name']);
        $suffix          = opt($r['suffix']);
        $birthDate       = safeDate($r['birth_date']);
        $placeOfBirth    = opt($r['place_of_birth']);
        $bloodType       = opt($r['blood_type']);
        $contactNumber   = opt($r['contact_number']);
        $email           = opt($r['email_address']);
        $addrPermanent   = opt($r['address_permanent']);
        $addrResidential = opt($r['address_residential']);
        $tinNo           = opt($r['tin_no']);
        $sssNo           = opt($r['sss_no']);
        $gsisNo          = opt($r['gsis_no']);
        $philhealthNo    = opt($r['philhealth_no']);
        $pagibigNo       = opt($r['pagibig_no']);
        $positionTitle   = opt($r['position_title']);
        $dateHired       = safeDate($r['date_hired']);
        $dateRegularized = safeDate($r['date_regularized']);
        $dateSeparated   = safeDate($r['date_separated']);
        $separationCause = opt($r['separation_cause']);
        $remarks         = opt($r['remarks']);

        // ── Bind and execute INSERT ───────────────────────────────────────────
        $insStmt->bind_param(
            'ssssssssssssssssssssssssssssssssssss',
            $employeeId,     $employeeNo,
            $lastName,       $firstName,       $middleName,   $suffix,
            $sex,            $birthDate,       $placeOfBirth,
            $civilStatus,    $citizenship,
            $heightM,        $weightKg,        $bloodType,
            $contactNumber,  $email,
            $addrPermanent,  $addrResidential,
            $tinNo,          $sssNo,           $gsisNo,       $philhealthNo, $pagibigNo,
            $resolvedDeptId, $resolvedSectionId, $positionTitle,
            $sg,             $step,            $salary,
            $appointmentType, $empStatus,
            $dateHired,      $dateRegularized, $dateSeparated,
            $separationCause, $remarks
        );

        try {
            $insStmt->execute();
            $inserted++;
        } catch (mysqli_sql_exception $rowEx) {
            if ($rowEx->getCode() === 1062) {
                $err = $rowEx->getMessage();
                $msg = "Duplicate entry";
                if      (str_contains($err, 'tin_no'))      $msg .= " (TIN already exists)";
                elseif  (str_contains($err, 'gsis_no'))     $msg .= " (GSIS already exists)";
                elseif  (str_contains($err, 'philhealth'))  $msg .= " (PhilHealth already exists)";
                elseif  (str_contains($err, 'sss_no'))      $msg .= " (SSS already exists)";
                elseif  (str_contains($err, 'employee_no')) $msg .= " (Employee No. already exists)";
                elseif  (str_contains($err, 'email'))       $msg .= " (Email already exists)";
                $skipped[] = ["row" => $rowNum, "reason" => $msg];
            } else {
                // Unexpected DB error — abort entire import
                throw $rowEx;
            }
        }
    }

    $insStmt->close();
    $conn->commit();

    http_response_code(200);
    echo json_encode([
        "status"          => "success",
        "message"         => "$inserted employee(s) imported successfully",
        "inserted"        => $inserted,
        "skipped"         => count($skipped),
        "skipped_details" => $skipped,
        "detected_keys"   => !empty($rows[0]) ? array_keys($rows[0]) : [],
    ]);

} catch (mysqli_sql_exception $e) {
    $conn->rollback();
    error_log("[import_employees] DB error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status"  => "error",
        "message" => "An unexpected error occurred. Please try again later.",
    ]);
} catch (Exception $e) {
    $conn->rollback();
    error_log("[import_employees] Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status"  => "error",
        "message" => "An unexpected error occurred. Please try again later.",
    ]);
} finally {
    $conn->close();
}
?>