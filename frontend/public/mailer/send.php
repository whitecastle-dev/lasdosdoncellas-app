<?php
/**
 * Relé de correo para Las Dos Doncellas — desarrollado por WhiteCastle.dev
 *
 * El backend (Render) no puede abrir conexiones SMTP salientes en el plan
 * gratuito, así que envía aquí el mensaje MIME ya construido y este script,
 * que corre en el mismo hosting que el buzón, lo entrega por SMTP local.
 *
 * Seguridad: cabecera X-Mail-Secret debe coincidir con el contenido del
 * fichero ~/.mailer_secret (fuera de public_html). Solo POST JSON.
 */

header('Content-Type: application/json; charset=utf-8');

function fail(int $code, string $msg): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'method');

$secretFile = dirname($_SERVER['DOCUMENT_ROOT']) . '/.mailer_secret';
$secret = is_readable($secretFile) ? trim((string) file_get_contents($secretFile)) : '';
$given = $_SERVER['HTTP_X_MAIL_SECRET'] ?? '';
if ($secret === '' || !hash_equals($secret, $given)) fail(403, 'forbidden');

$raw = file_get_contents('php://input');
$in = json_decode($raw, true);
if (!is_array($in)) fail(400, 'json');

$from = filter_var($in['from'] ?? '', FILTER_VALIDATE_EMAIL);
$tos = array_values(array_filter(array_map(fn($t) => filter_var($t, FILTER_VALIDATE_EMAIL), (array) ($in['to'] ?? []))));
$message = base64_decode((string) ($in['raw'] ?? ''), true);
if (!$from || !$tos || $message === false || $message === '') fail(400, 'params');

$cfgFile = dirname($_SERVER['DOCUMENT_ROOT']) . '/.mailer_config.json';
$cfg = is_readable($cfgFile) ? json_decode((string) file_get_contents($cfgFile), true) : null;
if (!is_array($cfg) || empty($cfg['user']) || empty($cfg['password'])) fail(500, 'config');
$host = $cfg['host'] ?? 'localhost';
$port = (int) ($cfg['port'] ?? 465);

$ctx = stream_context_create(['ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true]]);
$sock = @stream_socket_client(($port === 465 ? 'ssl://' : 'tcp://') . $host . ':' . $port, $errno, $errstr, 30, STREAM_CLIENT_CONNECT, $ctx);
if (!$sock) fail(502, "connect: $errstr");
stream_set_timeout($sock, 30);

function smtp_read($sock): array {
    $data = '';
    while (($line = fgets($sock, 2048)) !== false) {
        $data .= $line;
        if (strlen($line) < 4 || $line[3] !== '-') break;
    }
    return [(int) substr($data, 0, 3), $data];
}
function smtp_cmd($sock, string $cmd, array $okCodes): void {
    fwrite($sock, $cmd . "\r\n");
    [$code, $resp] = smtp_read($sock);
    if (!in_array($code, $okCodes, true)) { fclose($sock); fail(502, trim($cmd === '' ? $resp : (explode(' ', $cmd)[0] . ': ' . trim($resp)))); }
}

[$code] = smtp_read($sock);
if ($code !== 220) fail(502, 'banner');
smtp_cmd($sock, 'EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'), [250]);
if ($port !== 465) {
    smtp_cmd($sock, 'STARTTLS', [220]);
    if (!stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) fail(502, 'starttls');
    smtp_cmd($sock, 'EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'), [250]);
}
smtp_cmd($sock, 'AUTH LOGIN', [334]);
smtp_cmd($sock, base64_encode($cfg['user']), [334]);
smtp_cmd($sock, base64_encode($cfg['password']), [235]);
smtp_cmd($sock, "MAIL FROM:<$from>", [250]);
foreach ($tos as $to) smtp_cmd($sock, "RCPT TO:<$to>", [250, 251]);
smtp_cmd($sock, 'DATA', [354]);
$body = preg_replace('/^\./m', '..', str_replace(["\r\n", "\n"], ["\n", "\r\n"], $message));
fwrite($sock, rtrim($body, "\r\n") . "\r\n.\r\n");
[$code, $resp] = smtp_read($sock);
if ($code !== 250) fail(502, 'data: ' . trim($resp));
fwrite($sock, "QUIT\r\n");
fclose($sock);

echo json_encode(['ok' => true, 'recipients' => count($tos)]);
