@echo off
cd /d "%~dp0.."
node scripts/backup_db.cjs
