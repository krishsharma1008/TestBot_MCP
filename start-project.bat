@echo off
REM Batch file wrapper for starting the ShipCruiseTour POC project
REM This provides a simple double-click execution option

echo Starting ShipCruiseTour POC Project...
echo.

REM Execute PowerShell script
powershell.exe -ExecutionPolicy Bypass -File "%~dp0start-project.ps1"

REM Pause if there was an error
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo An error occurred. Press any key to exit...
    pause >nul
)
