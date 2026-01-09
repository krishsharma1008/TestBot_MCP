<?php
declare(strict_types=1);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    http_response_code(405);
    header('Content-Type: text/plain');
    echo 'Method Not Allowed';
    exit();
}

$name = trim($_POST['name'] ?? '');
$email = trim($_POST['email'] ?? '');
$subject = trim($_POST['subject'] ?? 'Contact Form Submission');
$message = trim($_POST['message'] ?? '');
$phone = trim($_POST['phone'] ?? 'N/A');
$company = trim($_POST['company'] ?? 'N/A');

$errors = [];
if ($name === '') {
    $errors[] = 'Name is required';
}
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Valid email is required';
}
if ($message === '') {
    $errors[] = 'Message is required';
}

if (!empty($errors)) {
    http_response_code(422);
    header('Content-Type: text/plain; charset=utf-8');
    echo implode("\n", $errors);
    exit();
}

$storageDir = realpath(__DIR__ . '/../storage');
if ($storageDir === false) {
    $storageDir = __DIR__ . '/../storage';
}
if (!is_dir($storageDir) && !mkdir($storageDir, 0775, true) && !is_dir($storageDir)) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Unable to initialize storage directory.';
    exit();
}

$logFile = $storageDir . '/contact_submissions.log';
$payload = [
    'timestamp' => date('c'),
    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
    'name' => $name,
    'email' => $email,
    'subject' => $subject,
    'message' => $message,
    'phone' => $phone,
    'company' => $company,
];

file_put_contents($logFile, json_encode($payload, JSON_UNESCAPED_SLASHES) . PHP_EOL, FILE_APPEND);

// In production this is where mail() or an ESP SDK would be invoked.

header('Content-Type: text/plain; charset=utf-8');
echo 'OK';
