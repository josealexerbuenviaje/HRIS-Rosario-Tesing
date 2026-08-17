<?php
// ============================================================
//  refresh_token.php
//  POST — returns a new token if the current one is still valid
// ============================================================
require_once 'bootstrap.php';
$auth = requireAuth();
try {
    // $auth->sub holds the user id (set as "sub" in generateToken)
    // Your original code used $auth->user_id which doesn't exist in the payload
    $stmt = $conn->prepare("
        SELECT id, first_name, last_name, email, username, role, status
        FROM users WHERE id = ? LIMIT 1
    ");
    $stmt->bind_param("s", $auth->sub);   // <-- was $auth->user_id (bug fix)
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$user || $user['status'] !== 'Active') {
        http_response_code(403);
        echo json_encode(["success" => false, "error" => "Account is inactive."]);
        exit;
    }

    $newToken = generateToken($user);

    // Decode to expose exp so the JS client can cache it for UX
    $parts   = explode('.', $newToken);
    $payload = json_decode(base64_decode(str_pad(
        strtr($parts[1], '-_', '+/'),
        strlen($parts[1]) % 4 === 0 ? strlen($parts[1]) : strlen($parts[1]) + 4 - strlen($parts[1]) % 4,
        '='
    )));

    echo json_encode([
        "success" => true,
        "token"   => $newToken,
        "exp"     => $payload->exp ?? null,  // client uses this for refresh scheduling
    ]);

} catch (mysqli_sql_exception $e) {
    error_log("[refresh_token] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "An unexpected error occurred."]);
} finally {
    $conn->close();
}
?>