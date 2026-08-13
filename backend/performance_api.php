<?php
// ============================================================
//  performance_api.php
//
//  GET  ?action=get_employees
//  GET  ?action=get_evaluations&search=&from=&to=
//  GET  ?action=get_goals&search=&status=
//  GET  ?action=get_reviews&search=&from=&to=
//  GET  ?action=get_feedback&search=&from=&to=
//  GET  ?action=generate_report&type=&from=&to=&format=csv
//
//  POST ?action=add_evaluation
//  POST ?action=add_goal
//  POST ?action=add_review
//  POST ?action=add_feedback
//
//  POST ?action=update_goal_status
//
//  POST ?action=delete_evaluation
//  POST ?action=delete_goal
//  POST ?action=delete_review
//  POST ?action=delete_feedback
//
// ============================================================
require_once 'bootstrap.php';
$method = $_SERVER['REQUEST_METHOD'];
$action = trim($_GET['action'] ?? '');

if (!$action) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Missing action"]);
    exit;
}

try {

    // ============================================================
    // GET EMPLOYEES (for dropdown)
    // ============================================================
    if ($action === 'get_employees' && $method === 'GET') {

        $stmt = $conn->prepare("
            SELECT employee_id,
                   CONCAT(last_name, ', ', first_name) AS full_name
            FROM employee
            WHERE employment_status NOT IN ('Separated','Retired','AWOL','Deceased')
            ORDER BY last_name ASC
        ");
        $stmt->execute();

        $data = [];
        $r = $stmt->get_result();
        while ($row = $r->fetch_assoc()) $data[] = $row;
        $stmt->close();

        echo json_encode(["status" => "success", "data" => $data]);

    // ============================================================
    // GET EVALUATIONS
    // ============================================================
    } elseif ($action === 'get_evaluations' && $method === 'GET') {

        $search = trim($_GET['search'] ?? '');
        $from   = trim($_GET['from'] ?? '');
        $to     = trim($_GET['to'] ?? '');

        $conditions = [];
        $params = [];
        $types = "";

        if ($search !== '') {
            $conditions[] = "(CONCAT(e.last_name, ', ', e.first_name) LIKE ? OR pe.rating LIKE ?)";
            $like = "%$search%";
            $params[] = $like;
            $params[] = $like;
            $types .= "ss";
        }

        if ($from !== '' && $to !== '') {
            $conditions[] = "pe.evaluation_date BETWEEN ? AND ?";
            $params[] = $from;
            $params[] = $to;
            $types .= "ss";
        }

        $where = $conditions ? "WHERE " . implode(" AND ", $conditions) : "";

        $stmt = $conn->prepare("
            SELECT pe.evaluation_id,
                   pe.employee_id,
                   CONCAT(e.last_name, ', ', e.first_name) AS employee_name,
                   pe.rating,
                   pe.comments,
                   pe.evaluation_date,
                   pe.created_at
            FROM performance_evaluations pe
            JOIN employee e ON pe.employee_id = e.employee_id
            $where
            ORDER BY pe.evaluation_date DESC
        ");

        if ($types) $stmt->bind_param($types, ...$params);
        $stmt->execute();

        $data = [];
        $r = $stmt->get_result();
        while ($row = $r->fetch_assoc()) $data[] = $row;
        $stmt->close();

        echo json_encode(["status" => "success", "data" => $data]);

    // ============================================================
    // ADD EVALUATION
    // ============================================================
    } elseif ($action === 'add_evaluation' && $method === 'POST') {

        requireRole($auth, ['HR', 'Admin']);

        $data = json_decode(file_get_contents("php://input"), true);

        $employee_id = trim($data['employee_id'] ?? '');
        $rating      = trim($data['rating'] ?? '');
        $comments    = trim($data['comments'] ?? '');
        $eval_date   = trim($data['evaluation_date'] ?? date("Y-m-d"));

        if (!$employee_id || !$rating) {
            http_response_code(422);
            echo json_encode(["status" => "error", "message" => "employee_id and rating are required"]);
            exit;
        }

        $validRatings = ['Excellent','Good','Satisfactory','Needs Improvement'];
        if (!in_array($rating, $validRatings)) {
            http_response_code(422);
            echo json_encode(["status" => "error", "message" => "Invalid rating value"]);
            exit;
        }

        $seq = $conn->query("SELECT COUNT(*) AS c FROM performance_evaluations")->fetch_assoc()['c'] + 1;
        $evalId = "EVAL-" . str_pad($seq, 5, "0", STR_PAD_LEFT);

        $stmt = $conn->prepare("
            INSERT INTO performance_evaluations
                (evaluation_id, employee_id, rating, comments, evaluation_date, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("ssssss", $evalId, $employee_id, $rating, $comments, $eval_date, $auth->user_id);
        $stmt->execute();
        $stmt->close();

        echo json_encode(["status" => "success", "message" => "Evaluation added.", "evaluation_id" => $evalId]);

    // ============================================================
    // DELETE EVALUATION
    // ============================================================
    } elseif ($action === 'delete_evaluation' && $method === 'POST') {

        requireRole($auth, ['HR', 'Admin']);

        $data = json_decode(file_get_contents("php://input"), true);
        $id = trim($data['evaluation_id'] ?? '');

        if (!$id) {
            http_response_code(422);
            echo json_encode(["status" => "error", "message" => "Missing evaluation_id"]);
            exit;
        }

        $stmt = $conn->prepare("DELETE FROM performance_evaluations WHERE evaluation_id = ?");
        $stmt->bind_param("s", $id);
        $stmt->execute();
        $stmt->close();

        echo json_encode(["status" => "success", "message" => "Evaluation deleted."]);

    // ============================================================
    // GET GOALS
    // ============================================================
    } elseif ($action === 'get_goals' && $method === 'GET') {

        $search = trim($_GET['search'] ?? '');
        $status = trim($_GET['status'] ?? '');

        $conditions = [];
        $params = [];
        $types = "";

        if ($search !== '') {
            $conditions[] = "(CONCAT(e.last_name, ', ', e.first_name) LIKE ? OR pg.goal_description LIKE ?)";
            $like = "%$search%";
            $params[] = $like;
            $params[] = $like;
            $types .= "ss";
        }

        if ($status !== '' && $status !== 'All') {
            $conditions[] = "pg.status = ?";
            $params[] = $status;
            $types .= "s";
        }

        $where = $conditions ? "WHERE " . implode(" AND ", $conditions) : "";

        $stmt = $conn->prepare("
            SELECT pg.goal_id,
                   pg.employee_id,
                   CONCAT(e.last_name, ', ', e.first_name) AS employee_name,
                   pg.goal_description,
                   pg.deadline,
                   pg.status,
                   pg.created_at
            FROM performance_goals pg
            JOIN employee e ON pg.employee_id = e.employee_id
            $where
            ORDER BY pg.created_at DESC
        ");

        if ($types) $stmt->bind_param($types, ...$params);
        $stmt->execute();

        $data = [];
        $r = $stmt->get_result();
        while ($row = $r->fetch_assoc()) $data[] = $row;
        $stmt->close();

        echo json_encode(["status" => "success", "data" => $data]);

    // ============================================================
    // ADD GOAL
    // ============================================================
    } elseif ($action === 'add_goal' && $method === 'POST') {

        requireRole($auth, ['HR', 'Admin']);

        $data = json_decode(file_get_contents("php://input"), true);

        $employee_id = trim($data['employee_id'] ?? '');
        $goal        = trim($data['goal_description'] ?? '');
        $deadline    = trim($data['deadline'] ?? null);

        if (!$employee_id || !$goal) {
            http_response_code(422);
            echo json_encode(["status" => "error", "message" => "employee_id and goal_description are required"]);
            exit;
        }

        $seq = $conn->query("SELECT COUNT(*) AS c FROM performance_goals")->fetch_assoc()['c'] + 1;
        $goalId = "GOAL-" . str_pad($seq, 5, "0", STR_PAD_LEFT);

        $stmt = $conn->prepare("
            INSERT INTO performance_goals
                (goal_id, employee_id, goal_description, deadline, status, created_by)
            VALUES (?, ?, ?, ?, 'Pending', ?)
        ");
        $stmt->bind_param("sssss", $goalId, $employee_id, $goal, $deadline, $auth->user_id);
        $stmt->execute();
        $stmt->close();

        echo json_encode(["status" => "success", "message" => "Goal added.", "goal_id" => $goalId]);

    // ============================================================
    // UPDATE GOAL STATUS
    // ============================================================
    } elseif ($action === 'update_goal_status' && $method === 'POST') {

        requireRole($auth, ['HR', 'Admin']);

        $data = json_decode(file_get_contents("php://input"), true);

        $goal_id = trim($data['goal_id'] ?? '');
        $status  = trim($data['status'] ?? '');

        if (!$goal_id || !$status) {
            http_response_code(422);
            echo json_encode(["status" => "error", "message" => "goal_id and status required"]);
            exit;
        }

        $valid = ['Pending','In Progress','Completed'];
        if (!in_array($status, $valid)) {
            http_response_code(422);
            echo json_encode(["status" => "error", "message" => "Invalid status"]);
            exit;
        }

        $stmt = $conn->prepare("UPDATE performance_goals SET status = ? WHERE goal_id = ?");
        $stmt->bind_param("ss", $status, $goal_id);
        $stmt->execute();
        $stmt->close();

        echo json_encode(["status" => "success", "message" => "Goal status updated."]);

    // ============================================================
    // DELETE GOAL
    // ============================================================
    } elseif ($action === 'delete_goal' && $method === 'POST') {

        requireRole($auth, ['HR', 'Admin']);

        $data = json_decode(file_get_contents("php://input"), true);
        $id = trim($data['goal_id'] ?? '');

        if (!$id) {
            http_response_code(422);
            echo json_encode(["status" => "error", "message" => "Missing goal_id"]);
            exit;
        }

        $stmt = $conn->prepare("DELETE FROM performance_goals WHERE goal_id = ?");
        $stmt->bind_param("s", $id);
        $stmt->execute();
        $stmt->close();

        echo json_encode(["status" => "success", "message" => "Goal deleted."]);

    // ============================================================
    // GET REVIEWS
    // ============================================================
    } elseif ($action === 'get_reviews' && $method === 'GET') {

        $search = trim($_GET['search'] ?? '');
        $from   = trim($_GET['from'] ?? '');
        $to     = trim($_GET['to'] ?? '');

        $conditions = [];
        $params = [];
        $types = "";

        if ($search !== '') {
            $conditions[] = "(CONCAT(e.last_name, ', ', e.first_name) LIKE ? OR pr.reviewer LIKE ?)";
            $like = "%$search%";
            $params[] = $like;
            $params[] = $like;
            $types .= "ss";
        }

        if ($from !== '' && $to !== '') {
            $conditions[] = "pr.review_date BETWEEN ? AND ?";
            $params[] = $from;
            $params[] = $to;
            $types .= "ss";
        }

        $where = $conditions ? "WHERE " . implode(" AND ", $conditions) : "";

        $stmt = $conn->prepare("
            SELECT pr.review_id,
                   pr.employee_id,
                   CONCAT(e.last_name, ', ', e.first_name) AS employee_name,
                   pr.review_text,
                   pr.reviewer,
                   pr.review_date,
                   pr.created_at
            FROM performance_reviews pr
            JOIN employee e ON pr.employee_id = e.employee_id
            $where
            ORDER BY pr.review_date DESC
        ");

        if ($types) $stmt->bind_param($types, ...$params);
        $stmt->execute();

        $data = [];
        $r = $stmt->get_result();
        while ($row = $r->fetch_assoc()) $data[] = $row;
        $stmt->close();

        echo json_encode(["status" => "success", "data" => $data]);

    // ============================================================
    // ADD REVIEW
    // ============================================================
    } elseif ($action === 'add_review' && $method === 'POST') {

        requireRole($auth, ['HR', 'Admin']);

        $data = json_decode(file_get_contents("php://input"), true);

        $employee_id = trim($data['employee_id'] ?? '');
        $review_text = trim($data['review_text'] ?? '');
        $reviewer    = trim($data['reviewer'] ?? '');
        $review_date = trim($data['review_date'] ?? date("Y-m-d"));

        if (!$employee_id || !$review_text || !$reviewer) {
            http_response_code(422);
            echo json_encode(["status" => "error", "message" => "employee_id, review_text, and reviewer are required"]);
            exit;
        }

        $seq = $conn->query("SELECT COUNT(*) AS c FROM performance_reviews")->fetch_assoc()['c'] + 1;
        $reviewId = "REV-" . str_pad($seq, 5, "0", STR_PAD_LEFT);

        $stmt = $conn->prepare("
            INSERT INTO performance_reviews
                (review_id, employee_id, review_text, reviewer, review_date, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("ssssss", $reviewId, $employee_id, $review_text, $reviewer, $review_date, $auth->user_id);
        $stmt->execute();
        $stmt->close();

        echo json_encode(["status" => "success", "message" => "Review added.", "review_id" => $reviewId]);

    // ============================================================
    // DELETE REVIEW
    // ============================================================
    } elseif ($action === 'delete_review' && $method === 'POST') {

        requireRole($auth, ['HR', 'Admin']);

        $data = json_decode(file_get_contents("php://input"), true);
        $id = trim($data['review_id'] ?? '');

        if (!$id) {
            http_response_code(422);
            echo json_encode(["status" => "error", "message" => "Missing review_id"]);
            exit;
        }

        $stmt = $conn->prepare("DELETE FROM performance_reviews WHERE review_id = ?");
        $stmt->bind_param("s", $id);
        $stmt->execute();
        $stmt->close();

        echo json_encode(["status" => "success", "message" => "Review deleted."]);

    // ============================================================
    // GET FEEDBACK
    // ============================================================
    } elseif ($action === 'get_feedback' && $method === 'GET') {

        $search = trim($_GET['search'] ?? '');
        $from   = trim($_GET['from'] ?? '');
        $to     = trim($_GET['to'] ?? '');

        $conditions = [];
        $params = [];
        $types = "";

        if ($search !== '') {
            $conditions[] = "(CONCAT(e.last_name, ', ', e.first_name) LIKE ? OR pf.feedback_text LIKE ?)";
            $like = "%$search%";
            $params[] = $like;
            $params[] = $like;
            $types .= "ss";
        }

        if ($from !== '' && $to !== '') {
            $conditions[] = "pf.feedback_date BETWEEN ? AND ?";
            $params[] = $from;
            $params[] = $to;
            $types .= "ss";
        }

        $where = $conditions ? "WHERE " . implode(" AND ", $conditions) : "";

        $stmt = $conn->prepare("
            SELECT pf.feedback_id,
                   pf.employee_id,
                   CONCAT(e.last_name, ', ', e.first_name) AS employee_name,
                   pf.feedback_text,
                   pf.submitted_by,
                   pf.feedback_date,
                   pf.created_at
            FROM performance_feedback pf
            JOIN employee e ON pf.employee_id = e.employee_id
            $where
            ORDER BY pf.feedback_date DESC
        ");

        if ($types) $stmt->bind_param($types, ...$params);
        $stmt->execute();

        $data = [];
        $r = $stmt->get_result();
        while ($row = $r->fetch_assoc()) $data[] = $row;
        $stmt->close();

        echo json_encode(["status" => "success", "data" => $data]);

    // ============================================================
    // ADD FEEDBACK
    // ============================================================
    } elseif ($action === 'add_feedback' && $method === 'POST') {

        requireRole($auth, ['HR', 'Admin']);

        $data = json_decode(file_get_contents("php://input"), true);

        $employee_id   = trim($data['employee_id'] ?? '');
        $feedback_text = trim($data['feedback_text'] ?? '');
        $submitted_by  = trim($data['submitted_by'] ?? 'Anonymous');
        $feedback_date = trim($data['feedback_date'] ?? date("Y-m-d"));

        if (!$employee_id || !$feedback_text) {
            http_response_code(422);
            echo json_encode(["status" => "error", "message" => "employee_id and feedback_text are required"]);
            exit;
        }

        $seq = $conn->query("SELECT COUNT(*) AS c FROM performance_feedback")->fetch_assoc()['c'] + 1;
        $fbId = "FB-" . str_pad($seq, 5, "0", STR_PAD_LEFT);

        $stmt = $conn->prepare("
            INSERT INTO performance_feedback
                (feedback_id, employee_id, feedback_text, submitted_by, feedback_date, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("ssssss", $fbId, $employee_id, $feedback_text, $submitted_by, $feedback_date, $auth->user_id);
        $stmt->execute();
        $stmt->close();

        echo json_encode(["status" => "success", "message" => "Feedback submitted.", "feedback_id" => $fbId]);

    // ============================================================
    // DELETE FEEDBACK
    // ============================================================
    } elseif ($action === 'delete_feedback' && $method === 'POST') {

        requireRole($auth, ['HR', 'Admin']);

        $data = json_decode(file_get_contents("php://input"), true);
        $id = trim($data['feedback_id'] ?? '');

        if (!$id) {
            http_response_code(422);
            echo json_encode(["status" => "error", "message" => "Missing feedback_id"]);
            exit;
        }

        $stmt = $conn->prepare("DELETE FROM performance_feedback WHERE feedback_id = ?");
        $stmt->bind_param("s", $id);
        $stmt->execute();
        $stmt->close();

        echo json_encode(["status" => "success", "message" => "Feedback deleted."]);

    // ============================================================
    // GENERATE REPORT (CSV)
    // ============================================================
    } elseif ($action === 'generate_report' && $method === 'GET') {

        requireRole($auth, ['HR', 'Admin']);

        $type = trim($_GET['type'] ?? 'evaluation_summary');
        $from = trim($_GET['from'] ?? date("Y-01-01"));
        $to   = trim($_GET['to'] ?? date("Y-m-d"));

        if ($type === 'evaluation_summary') {
            $stmt = $conn->prepare("
                SELECT CONCAT(e.last_name, ', ', e.first_name) AS employee,
                       pe.rating,
                       pe.comments,
                       pe.evaluation_date
                FROM performance_evaluations pe
                JOIN employee e ON pe.employee_id = e.employee_id
                WHERE pe.evaluation_date BETWEEN ? AND ?
                ORDER BY pe.evaluation_date DESC
            ");
            $stmt->bind_param("ss", $from, $to);

        } elseif ($type === 'goal_achievement') {
            $stmt = $conn->prepare("
                SELECT CONCAT(e.last_name, ', ', e.first_name) AS employee,
                       pg.goal_description,
                       pg.deadline,
                       pg.status
                FROM performance_goals pg
                JOIN employee e ON pg.employee_id = e.employee_id
                WHERE pg.created_at BETWEEN ? AND ?
                ORDER BY pg.created_at DESC
            ");
            $stmt->bind_param("ss", $from, $to);

        } else {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Invalid report type"]);
            exit;
        }

        $stmt->execute();
        $result = $stmt->get_result();

        $rows = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;
        $stmt->close();

        header('Content-Type: text/csv');
        header("Content-Disposition: attachment; filename=\"performance_{$type}_{$from}_to_{$to}.csv\"");

        $out = fopen('php://output', 'w');
        if (!empty($rows)) {
            fputcsv($out, array_keys($rows[0]));
            foreach ($rows as $row) fputcsv($out, $row);
        }
        fclose($out);

    } else {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Invalid action: $action"]);
    }

} catch (mysqli_sql_exception $e) {

    error_log("[performance_api] $action — " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An unexpected error occurred."]);

} finally {
    $conn->close();
}
?>