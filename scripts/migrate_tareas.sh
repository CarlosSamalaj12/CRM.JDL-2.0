#!/bin/bash

# Script de migración para Linux/Mac
# Sistema de Tareas por Evento

echo ""
echo "========================================"
echo "  MIGRACIÓN - SISTEMA DE TAREAS"
echo "========================================"
echo ""

# Verificar si mysql está disponible
if ! command -v mysql &> /dev/null; then
    echo "ERROR: MySQL CLI no encontrado"
    echo ""
    echo "Opciones:"
    echo "1. Usar el script Node.js: node scripts/migrate_tareas.js"
    echo "2. Instalar MySQL CLI: sudo apt-get install mysql-client"
    echo "3. Ejecutar el SQL manualmente desde MySQL Workbench"
    echo ""
    exit 1
fi

# Cargar variables del archivo .env si existe
if [ -f .env ]; then
    echo "Cargando configuración desde .env..."
    export $(grep -v '^#' .env | xargs)
fi

# Valores por defecto
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-3306}
DB_USER=${DB_USER:-root}
DB_NAME=${DB_NAME:-crm_jdl}

echo "Configuración:"
echo "  Host: $DB_HOST"
echo "  Puerto: $DB_PORT"
echo "  Usuario: $DB_USER"
echo "  Base de datos: $DB_NAME"
echo ""

read -p "¿Deseas continuar? (s/n): " CONFIRM
if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
    echo "Migración cancelada."
    exit 0
fi

echo ""
echo "Ejecutando migración..."
echo ""

# Solicitar password si no está definida
if [ -z "$DB_PASSWORD" ]; then
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" < db/migrate_tareas_evento.sql
else
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < db/migrate_tareas_evento.sql
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "  MIGRACIÓN COMPLETADA EXITOSAMENTE"
    echo "========================================"
else
    echo ""
    echo "ERROR: La migración falló"
    echo "Verifica las credenciales y permisos"
fi

echo ""
