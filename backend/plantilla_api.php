<?php
require_once 'bootstrap.php';
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if (!$action) {
    jsonResponse(["status" => "error", "message" => "Missing action"], 400);
}

/* ============================================================
   HELPERS
============================================================ */

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function getJsonBody() {
    return json_decode(file_get_contents("php://input"), true) ?? [];
}

/* ============================================================
   ROUTER
============================================================ */

try {

    switch ($action) {

        /* ====================================================
           GET POSITIONS
        ==================================================== */
        case 'get_positions':
            if ($method !== 'GET') break;

            $search  = trim($_GET['search'] ?? '');
            $dept_id = trim($_GET['dept_id'] ?? '');
            $status  = trim($_GET['status'] ?? '');

            $conditions = [];
            $params     = [];
            $types      = "";

            if ($search !== '') {
                $conditions[] = "(pi.position_title LIKE ? OR pi.item_number LIKE ?)";
                $like         = "%$search%";
                $params[]     = $like;
                $params[]     = $like;
                $types       .= "ss";
            }

            if ($dept_id !== '') {
                $conditions[] = "pi.dept_id = ?";
                $params[]     = $dept_id;
                $types       .= "s";
            }

            if ($status !== '' && $status !== 'All') {
                $conditions[] = "pi.status = ?";
                $params[]     = $status;
                $types       .= "s";
            }

            $where = $conditions ? "WHERE " . implode(" AND ", $conditions) : "";

            $sql = "
                SELECT pi.position_id, pi.item_number, pi.position_title,
                       pi.salary_grade, pi.monthly_salary, pi.status,
                       pi.dept_id, d.dept_name, d.dept_code,
                       CONCAT(e.last_name, ', ', e.first_name) AS incumbent_name,
                       e.employee_id AS incumbent_id
                FROM position_item pi
                JOIN department d ON pi.dept_id = d.dept_id
                LEFT JOIN employee e ON pi.position_id = e.position_id
                    AND e.employment_status NOT IN ('Separated','Retired','AWOL','Deceased')
                $where
                ORDER BY d.dept_name ASC, pi.salary_grade DESC
            ";

            $stmt = $conn->prepare($sql);
            if ($types) $stmt->bind_param($types, ...$params);
            $stmt->execute();

            $res  = $stmt->get_result();
            $data = [];
            while ($row = $res->fetch_assoc()) $data[] = $row;

            jsonResponse(["status" => "success", "data" => $data]);
            break;

        /* ====================================================
           ADD POSITION
        ==================================================== */
        case 'add_position':
            if ($method !== 'POST') break;
            requireRole($auth, ['HR', 'Admin']);

            $data = getJsonBody();

            foreach (['position_title', 'dept_id', 'salary_grade'] as $r) {
                if (empty($data[$r])) {
                    jsonResponse(["status" => "error", "message" => "Missing $r"], 422);
                }
            }

            $sg = (int)$data['salary_grade'];
            if ($sg < 1 || $sg > 33) {
                jsonResponse(["status" => "error", "message" => "Salary grade must be 1–33"], 422);
            }

            $chk = $conn->prepare("SELECT dept_id FROM department WHERE dept_id=? AND status='Active'");
            $chk->bind_param("s", $data['dept_id']);
            $chk->execute();
            if ($chk->get_result()->num_rows === 0) {
                jsonResponse(["status" => "error", "message" => "Department not found"], 404);
            }

            $sal = $conn->prepare("SELECT step_1 FROM salary_schedule WHERE salary_grade=?");
            $sal->bind_param("i", $sg);
            $sal->execute();
            $row           = $sal->get_result()->fetch_assoc();
            $monthlySalary = $row['step_1'] ?? ($data['monthly_salary'] ?? 0);

            $seq        = $conn->query("SELECT COUNT(*) c FROM position_item")->fetch_assoc()['c'] + 1;
            $positionId = "POS-" . str_pad($seq, 5, '0', STR_PAD_LEFT);
            $itemNumber = $data['item_number'] ?? ("ITEM-" . str_pad($seq, 5, '0', STR_PAD_LEFT));
            $remarks    = $data['remarks'] ?? '';

            $stmt = $conn->prepare("
                INSERT INTO position_item
                    (position_id, item_number, position_title, dept_id, salary_grade, monthly_salary, status, remarks)
                VALUES (?, ?, ?, ?, ?, ?, 'Vacant', ?)
            ");
            $stmt->bind_param(
                "ssssids",
                $positionId, $itemNumber, $data['position_title'],
                $data['dept_id'], $sg, $monthlySalary, $remarks
            );
            $stmt->execute();

            jsonResponse(["status" => "success", "message" => "Position added", "position_id" => $positionId]);
            break;

        /* ====================================================
           UPDATE POSITION
        ==================================================== */
        case 'update_position':
            if ($method !== 'POST') break;
            requireRole($auth, ['HR', 'Admin']);

            $data = getJsonBody();

            if (empty($data['position_id'])) {
                jsonResponse(["status" => "error", "message" => "Missing position_id"], 400);
            }

            $sg = (int)($data['salary_grade'] ?? 0);
            if ($sg < 1 || $sg > 33) {
                jsonResponse(["status" => "error", "message" => "Salary grade must be 1–33"], 422);
            }

            $stmt = $conn->prepare("
                UPDATE position_item
                SET position_title=?, dept_id=?, salary_grade=?, monthly_salary=?, status=?, remarks=?
                WHERE position_id=?
            ");
            $stmt->bind_param(
                "ssidss" . "s",
                $data['position_title'], $data['dept_id'],
                $sg, $data['monthly_salary'],
                $data['status'], $data['remarks'],
                $data['position_id']
            );
            $stmt->execute();

            jsonResponse(["status" => "success", "message" => "Position updated"]);
            break;

        /* ====================================================
           DELETE POSITION
        ==================================================== */
        case 'delete_position':
            if ($method !== 'POST') break;
            requireRole($auth, ['HR', 'Admin']);

            $data  = getJsonBody();
            $posId = $data['position_id'] ?? '';

            if (!$posId) jsonResponse(["status" => "error", "message" => "Missing position_id"], 400);

            $chk = $conn->prepare("SELECT status FROM position_item WHERE position_id=?");
            $chk->bind_param("s", $posId);
            $chk->execute();
            $pos = $chk->get_result()->fetch_assoc();

            if (!$pos) jsonResponse(["status" => "error", "message" => "Position not found"], 404);
            if ($pos['status'] === 'Occupied') {
                jsonResponse(["status" => "error", "message" => "Cannot delete an occupied position"], 409);
            }

            $del = $conn->prepare("DELETE FROM position_item WHERE position_id=?");
            $del->bind_param("s", $posId);
            $del->execute();

            jsonResponse(["status" => "success", "message" => "Position deleted"]);
            break;

        /* ====================================================
           GET SALARIES
        ==================================================== */
        case 'get_salaries':
            if ($method !== 'GET') break;

            $res  = $conn->query("SELECT * FROM salary_schedule ORDER BY salary_grade ASC");
            $data = [];
            while ($row = $res->fetch_assoc()) $data[] = $row;

            jsonResponse(["status" => "success", "data" => $data]);
            break;

        /* ====================================================
           UPDATE SALARY
        ==================================================== */
        case 'update_salary':
            if ($method !== 'POST') break;
            requireRole($auth, ['HR', 'Admin']);

            $data = getJsonBody();
            $sg   = (int)($data['salary_grade'] ?? 0);

            if ($sg < 1 || $sg > 33) {
                jsonResponse(["status" => "error", "message" => "Invalid salary grade"], 422);
            }

            $stmt = $conn->prepare("
                UPDATE salary_schedule
                SET step_1=?, step_2=?, step_3=?, step_4=?,
                    step_5=?, step_6=?, step_7=?, step_8=?
                WHERE salary_grade=?
            ");
            $stmt->bind_param(
                "ddddddddi",
                $data['step_1'], $data['step_2'], $data['step_3'], $data['step_4'],
                $data['step_5'], $data['step_6'], $data['step_7'], $data['step_8'],
                $sg
            );
            $stmt->execute();

            jsonResponse(["status" => "success", "message" => "Salary schedule updated"]);
            break;

        /* ====================================================
           GET VACANCIES
        ==================================================== */
        case 'get_vacancies':
            if ($method !== 'GET') break;

            $search = trim($_GET['search'] ?? '');
            $params = [];
            $types  = "";
            $where  = "WHERE pi.status = 'Vacant'";

            if ($search !== '') {
                $where   .= " AND pi.position_title LIKE ?";
                $params[] = "%$search%";
                $types   .= "s";
            }

            $sql = "
                SELECT pi.position_id, pi.item_number, pi.position_title,
                       pi.salary_grade, pi.monthly_salary,
                       d.dept_name, d.dept_code,
                       v.vacancy_id, v.posted_date, v.closing_date, v.vacancy_status
                FROM position_item pi
                JOIN department d ON pi.dept_id = d.dept_id
                LEFT JOIN vacancy v ON pi.position_id = v.position_id
                    AND v.vacancy_status = 'Open'
                $where
                ORDER BY d.dept_name ASC, pi.salary_grade DESC
            ";

            $stmt = $conn->prepare($sql);
            if ($types) $stmt->bind_param($types, ...$params);
            $stmt->execute();

            $res  = $stmt->get_result();
            $data = [];
            while ($row = $res->fetch_assoc()) $data[] = $row;

            jsonResponse(["status" => "success", "data" => $data]);
            break;

        /* ====================================================
           POST VACANCY
        ==================================================== */
        case 'post_vacancy':
            if ($method !== 'POST') break;
            requireRole($auth, ['HR', 'Admin']);

            $data  = getJsonBody();
            $posId = $data['position_id'] ?? '';

            if (!$posId) jsonResponse(["status" => "error", "message" => "Missing position_id"], 400);

            $chk = $conn->prepare("SELECT status FROM position_item WHERE position_id=?");
            $chk->bind_param("s", $posId);
            $chk->execute();
            $pos = $chk->get_result()->fetch_assoc();

            if (!$pos) jsonResponse(["status" => "error", "message" => "Position not found"], 404);
            if ($pos['status'] !== 'Vacant') {
                jsonResponse(["status" => "error", "message" => "Position is not vacant"], 409);
            }

            $dup = $conn->prepare("SELECT vacancy_id FROM vacancy WHERE position_id=? AND vacancy_status='Open'");
            $dup->bind_param("s", $posId);
            $dup->execute();
            if ($dup->get_result()->num_rows > 0) {
                jsonResponse(["status" => "error", "message" => "Vacancy already posted"], 409);
            }

            $seq      = $conn->query("SELECT COUNT(*) c FROM vacancy")->fetch_assoc()['c'] + 1;
            $vacId    = "VAC-" . str_pad($seq, 5, '0', STR_PAD_LEFT);
            $posted   = date('Y-m-d');
            $closing  = date('Y-m-d', strtotime('+30 days'));
            $postedBy = $auth->sub ?? null;

            $ins = $conn->prepare("
                INSERT INTO vacancy (vacancy_id, position_id, posted_date, closing_date, vacancy_status, posted_by)
                VALUES (?, ?, ?, ?, 'Open', ?)
            ");
            $ins->bind_param("sssss", $vacId, $posId, $posted, $closing, $postedBy);
            $ins->execute();

            jsonResponse(["status" => "success", "message" => "Vacancy posted", "vacancy_id" => $vacId]);
            break;

        /* ====================================================
           CLOSE VACANCY
        ==================================================== */
        case 'close_vacancy':
            if ($method !== 'POST') break;
            requireRole($auth, ['HR', 'Admin']);

            $data  = getJsonBody();
            $vacId = $data['vacancy_id'] ?? '';

            if (!$vacId) jsonResponse(["status" => "error", "message" => "Missing vacancy_id"], 400);

            $stmt = $conn->prepare("UPDATE vacancy SET vacancy_status='Closed' WHERE vacancy_id=?");
            $stmt->bind_param("s", $vacId);
            $stmt->execute();

            if ($stmt->affected_rows === 0) {
                jsonResponse(["status" => "error", "message" => "Vacancy not found"], 404);
            }

            jsonResponse(["status" => "success", "message" => "Vacancy closed"]);
            break;

        /* ====================================================
           GET UPDATES
        ==================================================== */
        case 'get_updates':
            if ($method !== 'GET') break;

            $res  = $conn->query("
                SELECT update_id, change_type, description, changed_by, created_at
                FROM plantilla_update
                ORDER BY created_at DESC
                LIMIT 200
            ");
            $data = [];
            while ($row = $res->fetch_assoc()) $data[] = $row;

            jsonResponse(["status" => "success", "data" => $data]);
            break;

        /* ====================================================
           LOG UPDATE
        ==================================================== */
        case 'log_update':
            if ($method !== 'POST') break;
            requireRole($auth, ['HR', 'Admin']);

            $data = getJsonBody();

            if (empty($data['change_type']) || empty($data['description'])) {
                jsonResponse(["status" => "error", "message" => "change_type and description are required"], 422);
            }

            $seq       = $conn->query("SELECT COUNT(*) c FROM plantilla_update")->fetch_assoc()['c'] + 1;
            $updateId  = "UPD-" . str_pad($seq, 5, '0', STR_PAD_LEFT);
            $changedBy = $auth->sub ?? null;

            $stmt = $conn->prepare("
                INSERT INTO plantilla_update (update_id, change_type, description, changed_by)
                VALUES (?, ?, ?, ?)
            ");
            $stmt->bind_param("ssss", $updateId, $data['change_type'], $data['description'], $changedBy);
            $stmt->execute();

            jsonResponse(["status" => "success", "message" => "Update logged", "update_id" => $updateId]);
            break;

        /* ====================================================
           GENERATE REPORT (CSV download)
        ==================================================== */
        case 'generate_report':
            if ($method !== 'GET') break;
            requireRole($auth, ['HR', 'Admin']);

            $type = $_GET['type'] ?? 'position_summary';

            switch ($type) {

                case 'position_summary':
                    $sql = "
                        SELECT pi.item_number, pi.position_title,
                               d.dept_name, d.dept_code,
                               pi.salary_grade, pi.monthly_salary, pi.status,
                               CONCAT(e.last_name, ', ', e.first_name) AS incumbent
                        FROM position_item pi
                        JOIN department d ON pi.dept_id = d.dept_id
                        LEFT JOIN employee e ON pi.position_id = e.position_id
                            AND e.employment_status NOT IN ('Separated','Retired','AWOL','Deceased')
                        ORDER BY d.dept_name, pi.salary_grade DESC
                    ";
                    $headers = ['Item No','Position Title','Department','Dept Code',
                                'Salary Grade','Monthly Salary','Status','Incumbent'];
                    break;

                case 'vacancy_report':
                    $sql = "
                        SELECT pi.item_number, pi.position_title,
                               d.dept_name, pi.salary_grade, pi.monthly_salary,
                               v.posted_date, v.closing_date, v.vacancy_status
                        FROM position_item pi
                        JOIN department d ON pi.dept_id = d.dept_id
                        LEFT JOIN vacancy v ON pi.position_id = v.position_id
                        WHERE pi.status = 'Vacant'
                        ORDER BY v.posted_date DESC
                    ";
                    $headers = ['Item No','Position Title','Department','Salary Grade',
                                'Monthly Salary','Posted Date','Closing Date','Vacancy Status'];
                    break;

                case 'salary_breakdown':
                    $sql     = "SELECT * FROM salary_schedule ORDER BY salary_grade ASC";
                    $headers = ['Salary Grade','Step 1','Step 2','Step 3','Step 4',
                                'Step 5','Step 6','Step 7','Step 8'];
                    break;

                default:
                    jsonResponse(["status" => "error", "message" => "Unknown report type"], 400);
            }

            $res  = $conn->query($sql);
            $rows = [];
            while ($row = $res->fetch_assoc()) $rows[] = $row;

            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="plantilla_' . $type . '_' . date('Ymd') . '.csv"');

            $out = fopen('php://output', 'w');
            fputcsv($out, $headers);
            foreach ($rows as $row) fputcsv($out, array_values($row));
            fclose($out);
            exit;

        default:
            jsonResponse(["status" => "error", "message" => "Invalid action '$action'"], 400);
    }

} catch (Exception $e) {
    error_log("[plantilla_api] " . $e->getMessage());
    jsonResponse(["status" => "error", "message" => "Server error: " . $e->getMessage()], 500);
}