@echo off
rem Doble clic para iniciar: ejecuta inicio.ps1 sin cambiar la política de ejecución de Windows.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0inicio.ps1" %*
pause
