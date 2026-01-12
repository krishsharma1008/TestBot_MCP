<?php
//define site url
// Use localhost for local development
if (!defined('BURL')) {
    // Detect base URL from server or use default
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';
    $baseUrl = $protocol . '://' . $host . '/';
    define('BURL', $baseUrl);
}

/****************************************************\
 * -               database  configuration              -
 * \****************************************************/

const HOST = "localhost";
const USER = "root";
const PASS = "";
const DBNAME = "shipcruisetour";


