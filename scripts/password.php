<?php
// CLI only. Pipe a password through stdin; avoid shell history and command arguments.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$password=trim(stream_get_contents(STDIN));
if (strlen($password)<14) { fwrite(STDERR,"Use at least 14 characters.\n"); exit(1); }
echo password_hash($password,PASSWORD_DEFAULT),PHP_EOL;
