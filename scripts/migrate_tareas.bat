@echo off
REM Script de migración para Windows
REM Sistema de Tareas por Evento

echo.
echo ========================================
echo   MIGRACION - SISTEMA DE TAREAS
echo ========================================
echo.

REM Verificar si mysql está disponible
where mysql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: MySQL CLI no encontrado en el PATH
    echo.
    echo Opciones:
    echo 1. Usar el script Node.js: node scripts\migrate_tareas.js
    echo 2. Instalar MySQL CLI y agregarlo al PATH
    echo 3. Ejecutar el SQL manualmente desde MySQL Workbench
    echo.
    pause
    exit /b 1
)

REM Cargar variables del archivo .env si existe
if exist .env (
    echo Cargando configuración desde .env...
    for /f "tokens=1,2 delims==" %%a in (.env) do (
        if "%%a"=="DB_HOST" set DB_HOST=%%b
        if "%%a"=="DB_PORT" set DB_PORT=%%b
        if "%%a"=="DB_USER" set DB_USER=%%b
        if "%%a"=="DB_PASSWORD" set DB_PASSWORD=%%b
        if "%%a"=="DB_NAME" set DB_NAME=%%b
    )
)

REM Valores por defecto
if "%DB_HOST%"=="" set DB_HOST=127.0.0.1
if "%DB_PORT%"=="" set DB_PORT=3306
if "%DB_USER%"=="" set DB_USER=root
if "%DB_NAME%"=="" set DB_NAME=crm_jdl

echo Configuración:
echo   Host: %DB_HOST%
echo   Puerto: %DB_PORT%
echo   Usuario: %DB_USER%
echo   Base de datos: %DB_NAME%
echo.

set /p CONFIRM="¿Deseas continuar? (s/n): "
if /i not "%CONFIRM%"=="s" (
    echo Migración cancelada.
    pause
    exit /b 0
)

echo.
echo Ejecutando migración...
echo.

mysql -h %DB_HOST% -P %DB_PORT% -u %DB_USER% -p%DB_PASSWORD% %DB_NAME% < db\migrate_tareas_evento.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   MIGRACION COMPLETADA EXITOSAMENTE
    echo ========================================
) else (
    echo.
    echo ERROR: La migración falló
    echo Verifica las credenciales y permisos
)

echo.
pause
