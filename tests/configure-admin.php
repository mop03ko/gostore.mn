<?php
// Exercise setup against disposable settings, never the real local config.
$directory = __DIR__.'/../tmp';
if (!is_dir($directory)) { mkdir($directory, 0700, true); }
$target = tempnam($directory, 'admin-setup-');
function run_setup(string $target, string $payload): int {
    $process = proc_open([PHP_BINARY, __DIR__.'/../scripts/configure-admin.php', $target],
        [0=>['pipe', 'r'], 1=>['pipe', 'w'], 2=>['pipe', 'w']], $pipes);
    if (!is_resource($process)) { throw new RuntimeException('Could not start setup.'); }
    fwrite($pipes[0], $payload);
    fclose($pipes[0]);
    stream_get_contents($pipes[1]); fclose($pipes[1]);
    stream_get_contents($pipes[2]); fclose($pipes[2]);
    return proc_close($process);
}
function check_setup(bool $condition, string $message): void {
    if (!$condition) { throw new RuntimeException($message); }
}
try {
    $original = ['qpay'=>['enabled'=>false, 'client_secret'=>'dummy-test-only'], 'site_url'=>'https://example.test'];
    file_put_contents($target, '<?php return '.var_export($original, true).';');
    $before = file_get_contents($target);
    check_setup(run_setup($target, '{invalid') !== 0, 'Malformed input must fail.');
    check_setup(file_get_contents($target) === $before, 'Invalid input changed settings.');
    $hash = password_hash('disposable-test-password', PASSWORD_BCRYPT);
    $payload = json_encode(['email'=>'admin@example.test', 'hash'=>$hash]);
    check_setup(run_setup($target, $payload) === 0, 'First admin setup failed.');
    $saved = require $target;
    check_setup($saved['qpay'] === $original['qpay'] && $saved['site_url'] === $original['site_url'], 'Integration settings changed.');
    check_setup($saved['admin_email'] === 'admin@example.test' && password_verify('disposable-test-password', $saved['admin_password_hash']), 'Admin credentials not saved correctly.');
    $before = file_get_contents($target);
    check_setup(run_setup($target, $payload) !== 0, 'Existing admin must not be overwritten.');
    check_setup(file_get_contents($target) === $before, 'Repeated setup changed settings.');
    echo "PASS: admin setup preserves integrations and rejects invalid input or existing admin.\n";
} finally {
    unlink($target);
}
