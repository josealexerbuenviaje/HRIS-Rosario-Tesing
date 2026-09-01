<?php
// ============================================================
//  bootstrap.php
//  Shared entry point for every API endpoint.
//  Handles CORS, then loads db.php and jwt_helper.php.
//  Usage: require_once 'bootstrap.php'; at the very top of
//  every endpoint file — replaces the old copy-pasted CORS
//  block that used to live in each file individually.
// ============================================================

// ── Allowed origins — the single source of truth for CORS ────────────────────
$allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "https://hris-rosario-tesing.vercel.app",
    "https://hris-user-management.vercel.app",
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: $origin");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

// Preflight — stop here, nothing else needs to run
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ── Load DB connection and JWT helpers once, for every endpoint ──────────────
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/jwt_helper.php';

// ── Enable mysqli exceptions so every failed query throws ────────────────────
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// ============================================================
//  SHARED ERROR RESPONSE HELPER
//  Usage: sendError(422, "Validation failed", ["errors" => $errors]);
//  Sends the HTTP status code, merges any extra data into the JSON
//  body alongside status/message, and stops execution.
// ============================================================
function sendError(int $code, string $message, array $extra = []): void
{
    http_response_code($code);
    echo json_encode(array_merge(
        ["status" => "error", "message" => $message],
        $extra
    ));
    exit;
}