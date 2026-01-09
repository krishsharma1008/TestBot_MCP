<?php
declare(strict_types=1);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Method Not Allowed';
    exit();
}

function field(string $key, string $default = ''): string
{
    return isset($_POST[$key]) ? trim((string)$_POST[$key]) : $default;
}

$name = field('name');
$email = field('email');
$subject = field('subject', 'Mock Contact Submission');
$message = field('message');

if ($name === '' || $email === '' || $message === '') {
    http_response_code(422);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Mock handler requires name, email, and message.';
    exit();
}

$payload = [
    'timestamp' => date('c'),
    'name' => $name,
    'email' => $email,
    'subject' => $subject,
    'message' => $message,
    'handler' => 'mock',
];

header('Content-Type: application/json; charset=utf-8');
echo json_encode($payload, JSON_UNESCAPED_SLASHES);
