<?php
// Copy to config.local.php. Never commit config.local.php.
return [
    'admin_email' => 'admin@gostore.mn',
    'admin_password_hash' => '', // Generate with scripts/password.php; never use plaintext here.
    'data_dir' => dirname(__DIR__, 2) . '/gostore-data', // MUST be outside public_html.
    'site_url' => 'https://gostore.mn',
    'otcommerce' => [
        'enabled' => false, // Reserved for the storefront integration; not implemented yet.
        'api_key' => '', // OT Commerce X-Api-Key; keep the real value in config.local.php.
    ],
    'qpay' => [
        'enabled' => false,
        'environment' => 'sandbox', // sandbox or production
        'client_id' => '',
        'client_secret' => '',
        'invoice_code' => '',
    ],
];
