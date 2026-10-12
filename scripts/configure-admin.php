<?php
// CLI-only first-admin setup. QPay and other local settings are preserved.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
try {
    $target = $argv[1] ?? (__DIR__.'/../server/config.local.php');
    $input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($input) || !filter_var($input['email'] ?? '', FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('Invalid admin email.');
    }
    $hash = $input['hash'] ?? '';
    if (!is_string($hash) || (password_get_info($hash)['algoName'] ?? 'unknown') !== 'bcrypt') {
        throw new RuntimeException('Invalid admin password hash.');
    }
    $config = is_file($target) ? require $target : [];
    if (!is_array($config)) { throw new RuntimeException('Local config must return an array.'); }
    if (!empty($config['admin_password_hash'])) {
        throw new RuntimeException('Admin already configured. Existing credentials were preserved.');
    }
    $config['admin_email'] = $input['email'];
    $config['admin_password_hash'] = $hash;
    $content = "<?php\nreturn ".var_export($config, true).";\n";
    if (file_put_contents($target, $content, LOCK_EX) === false) {
        throw new RuntimeException('Unable to save local configuration.');
    }
    echo "Admin configured; existing integration settings preserved.\n";
} catch (Throwable $e) {
    fwrite(STDERR, $e instanceof JsonException ? "Invalid setup input.\n" : $e->getMessage()."\n");
    exit(1);
}
