# Configuración de Respaldos Automáticos en Windows

Este directorio contiene un script en Node.js y un archivo por lotes (`.bat`) para realizar copias de seguridad de la base de datos MariaDB (`crm_jdl`) que corre en el puerto `3307`.

## Archivos
- `scripts/backup_db.cjs`: Script principal que se conecta a la base de datos, extrae la estructura y los datos de las 41 tablas, y genera los archivos `.sql`.
- `scripts/backup_db.bat`: Archivo ejecutable por Windows Task Scheduler que corre el script de Node.
- `db/crm_jdl_backup.sql`: Copia más reciente (sobrescrita en cada ejecución).
- `db/backups/crm_jdl_backup_YYYY-MM-DD_HHMMSS.sql`: Respaldos históricos con marca de tiempo.

---

## Cómo programar la copia a la 1:00 AM en Windows

Para que la copia de seguridad se ejecute automáticamente todas las madrugadas a la 1:00 AM, puedes programar una tarea en Windows usando cualquiera de las siguientes opciones:

### Opción 1: Programar desde la terminal (Símbolo del sistema como Administrador)

Abre la terminal de comandos (cmd) como **Administrador** y ejecuta el siguiente comando:

```cmd
schtasks /create /tn "MariaDB_CRM_Backup" /tr "C:\Users\kevin\Documents\WEB25\CRM.migrate\react\CRM.JDL\scripts\backup_db.bat" /sc daily /st 01:00 /f
```

*Nota: Asegúrate de que la ruta absoluta a `backup_db.bat` sea la correcta en tu máquina.*

### Opción 2: Usar la interfaz gráfica de Windows (Programador de Tareas)

1. Presiona la tecla `Windows`, busca **Programador de Tareas** (Task Scheduler) y ábrelo.
2. En el panel derecho, haz clic en **Crear tarea básica...** (Create Basic Task...).
3. Escribe un nombre para la tarea (ej. `MariaDB_CRM_Backup`) y una descripción opcional, luego haz clic en **Siguiente**.
4. En **Desencadenador** (Trigger), selecciona **Diariamente** (Daily) y haz clic en **Siguiente**.
5. Configura la hora de inicio a las **01:00:00** a partir de hoy y haz clic en **Siguiente**.
6. En **Acción**, selecciona **Iniciar un programa** (Start a program) y haz clic en **Siguiente**.
7. En el campo **Programa o script**, haz clic en **Examinar...** y selecciona el archivo `C:\Users\kevin\Documents\WEB25\CRM.migrate\react\CRM.JDL\scripts\backup_db.bat`.
8. En el campo **Iniciar en (opcional)**, escribe la ruta del directorio del script: `C:\Users\kevin\Documents\WEB25\CRM.migrate\react\CRM.JDL\scripts`.
9. Haz clic en **Siguiente** y luego en **Finalizar**.
