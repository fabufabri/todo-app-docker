# backup.ps1
# Genera un respaldo comprimido de la base de datos PostgreSQL que corre
# DENTRO del contenedor "todo_db", usando "docker exec".
#
# Para programarlo con el Programador de Tareas de Windows:
#   1) Abrí "Programador de tareas" (Task Scheduler)
#   2) Crear tarea básica -> Diariamente -> 03:00 AM
#   3) Acción: "Iniciar un programa"
#      Programa: powershell.exe
#      Argumentos: -ExecutionPolicy Bypass -File "C:\ruta\a\todo-app-docker\deploy\backup.ps1"

$ErrorActionPreference = "Stop"

$ProjectDir  = Split-Path -Parent $PSScriptRoot
$BackupDir   = "C:\todo-backups"
$Date        = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$File        = Join-Path $BackupDir "todo_db_$Date.sql.gz"

# Carga DB_USER / DB_NAME desde el archivo .env del proyecto
$envFile = Join-Path $ProjectDir ".env"
$envVars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

Write-Host "[$(Get-Date)] Iniciando respaldo..."

# docker exec + pg_dump; comprimimos con gzip (7-Zip también sirve si no tenés gzip)
docker exec todo_db pg_dump -U $envVars["DB_USER"] $envVars["DB_NAME"] | `
    Out-File -FilePath "$File.tmp" -Encoding utf8
Compress-Archive -Path "$File.tmp" -DestinationPath "$File.zip" -Force
Remove-Item "$File.tmp"

Write-Host "[$(Get-Date)] Respaldo creado: $File.zip"

# Elimina respaldos con más de 7 días
Get-ChildItem $BackupDir -Filter "*.zip" | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-7)
} | Remove-Item -Force

Write-Host "[$(Get-Date)] Respaldos antiguos eliminados (>7 días)."
