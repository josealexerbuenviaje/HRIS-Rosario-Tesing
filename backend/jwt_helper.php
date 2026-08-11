<?php
// ============================================================
//  jwt_helper.php (Improved / Production-Ready Structure)
//  Requires: composer require firebase/php-jwt
// ============================================================

require_once __DIR__ . '/vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

// ============================================================
//  SAFE .env LOADER
// ============================================================
function loadEnv(string $path): void
{
    if (!file_exists($path)) return;

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    foreach ($lines as $line) {
        $line = trim($line);

        // Skip comments
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        // Skip invalid lines
        if (!str_contains($line, '=')) {
            continue;
        }

        [$key, $value] = explode('=', $line, 2);

        $key = trim($key);
        $value = trim($value);

        // Remove quotes if wrapped in " " or ' '
        if (
            (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
            (str_starts_with($value, "'") && str_ends_with($value, "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        $_ENV[$key] = $value;
    }
}

// Load env (recommend: store .env outside public directory)
loadEnv(__DIR__ . '/.env');

// ============================================================
//  CONFIG (NO FALLBACK SECRET!)
// ============================================================
$JWT_SECRET = getenv('JWT_SECRET') ?: ($_ENV['JWT_SECRET'] ?? null);
$JWT_EXPIRY = (int)(getenv('JWT_EXPIRY') ?: ($_ENV['JWT_EXPIRY'] ?? 3600));
$JWT_ISSUER = getenv('JWT_ISSUER') ?: ($_ENV['JWT_ISSUER'] ?? 'rosario-hris');
$JWT_AUDIENCE = getenv('JWT_AUDIENCE') ?: ($_ENV['JWT_AUDIENCE'] ?? 'rosario-frontend');

if (!$JWT_SECRET) {
    die("JWT_SECRET is missing. Please set it in .env.");
}

// ============================================================
//  GENERATE TOKEN (clean payload)
// ============================================================
function generateToken(array $user): string
{
    global $JWT_SECRET, $JWT_EXPIRY, $JWT_ISSUER, $JWT_AUDIENCE;

    $now = time();

    $payload = [
        "iat" => $now,
        "exp" => $now + $JWT_EXPIRY,

        // Security claims
        "iss" => $JWT_ISSUER,
        "aud" => $JWT_AUDIENCE,

        // Unique token id (useful for blacklist/logout later)
        "jti" => bin2hex(random_bytes(16)),

        // Minimal user data (avoid storing email unless needed)
        "sub" => (string)$user['id'], // subject = user id
        "role" => $user['role'],
    ];

    return JWT::encode($payload, $JWT_SECRET, "HS256");
}

// ============================================================
//  VERIFY TOKEN (checks iss/aud + handles Authorization header)
// ============================================================
function verifyToken(): ?object
{
    global $JWT_SECRET, $JWT_ISSUER, $JWT_AUDIENCE;

    // Try every possible key Apache/PHP might use
    $authHeader = '';

    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (function_exists('getallheaders')) {
        $headers = getallheaders();
        // Case-insensitive search
        foreach ($headers as $key => $value) {
            if (strtolower($key) === 'authorization') {
                $authHeader = $value;
                break;
            }
        }
    }

    // Log what we actually received (remove after debugging)
    error_log("[JWT] Auth header received: " . ($authHeader ? substr($authHeader, 0, 30) . '...' : 'NONE'));

    if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
        error_log("[JWT] Missing or malformed Authorization header");
        return null;
    }

    $token = trim(substr($authHeader, 7));

    try {
        $decoded = JWT::decode($token, new Key($JWT_SECRET, 'HS256'));

        // Validate issuer
        if (!isset($decoded->iss) || $decoded->iss !== $JWT_ISSUER) {
            error_log("[JWT] Issuer mismatch. Got: " . ($decoded->iss ?? 'none') . " Expected: $JWT_ISSUER");
            return null;
        }

        // Validate audience
        if (!isset($decoded->aud) || $decoded->aud !== $JWT_AUDIENCE) {
            error_log("[JWT] Audience mismatch. Got: " . ($decoded->aud ?? 'none') . " Expected: $JWT_AUDIENCE");
            return null;
        }

        error_log("[JWT] Token valid for sub: " . ($decoded->sub ?? 'unknown'));
        return $decoded;

    } catch (Exception $e) {
        error_log("[JWT ERROR] " . $e->getMessage());
        return null;
    }
}

// ============================================================
//  REQUIRE AUTH (use at top of protected endpoints)
// ============================================================
function requireAuth(): object
{
    $payload = verifyToken();

    if (!$payload) {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "Unauthorized. Please log in again."
        ]);
        exit;
    }

    return $payload;
}

// ============================================================
//  REQUIRE ROLE
// ============================================================
function requireRole(object $auth, array $allowedRoles): void
{
    if (!isset($auth->role) || !in_array($auth->role, $allowedRoles, true)) {
        http_response_code(403);
        echo json_encode([
            "status" => "error",
            "message" => "Forbidden. You do not have permission to perform this action."
        ]);
        exit;
    }
}
?>