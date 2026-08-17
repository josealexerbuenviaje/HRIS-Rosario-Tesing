<?php
// ============================================================
//  get_dept_for_employee.php  —  HRIS Project backend
//  Returns Active departments with their Active sections nested.
//  Used by the two-level picker in NewEmployeeForm + EmployeeModal.
// ============================================================
require_once 'bootstrap.php';
$auth = requireAuth();
// Load all active departments
$deptRes = $conn->query("
    SELECT dept_id, dept_code, dept_name
    FROM department
    WHERE status = 'Active'
    ORDER BY dept_name ASC
");
if (!$deptRes) {
    http_response_code(500);
    echo json_encode(["status"=>"error","message"=>"DB error: ".$conn->error]); exit;
}

$depts = [];
while ($d = $deptRes->fetch_assoc()) {
    $depts[$d['dept_id']] = [
        'dept_id'   => $d['dept_id'],
        'dept_code' => $d['dept_code'],
        'dept_name' => $d['dept_name'],
        'sections'  => [],
    ];
}

// Nest active sections under their parent department
$secRes = $conn->query("
    SELECT section_id, section_code, section_name, dept_id
    FROM section
    WHERE status = 'Active'
    ORDER BY section_name ASC
");
if ($secRes) {
    while ($s = $secRes->fetch_assoc()) {
        if (isset($depts[$s['dept_id']])) {
            $depts[$s['dept_id']]['sections'][] = [
                'section_id'   => $s['section_id'],
                'section_code' => $s['section_code'],
                'section_name' => $s['section_name'],
            ];
        }
    }
}

echo json_encode([
    "status" => "success",
    "count"  => count($depts),
    "data"   => array_values($depts),
]);
$conn->close();
?>