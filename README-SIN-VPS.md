# Despliegue SIN VPS (sin tarjeta de crédito) — Tu PC Windows como servidor

## La idea

No necesitás pagar ni dar tarjeta en ningún lado. Tu propia PC va a cumplir el rol
del "VPS": vas a instalar Docker, administrar un firewall, tener backups automáticos
y un pipeline de CI/CD real. Lo único que cambia respecto a un VPS en la nube es
**quién es el servidor** — la lógica de administración es la misma, y es justamente
lo que evalúa la rúbrica.

Para que tu PC sea alcanzable desde Internet (sin necesidad de abrir puertos en tu
router ni tener IP pública fija) usamos **Cloudflare Tunnel**, un servicio gratuito,
sin registro obligatorio y sin tarjeta.

```
Internet ──► Cloudflare (túnel cifrado) ──► cloudflared (en tu PC) ──► localhost:80 (Nginx/Docker)
```

Y para que el despliegue sea automático (push → se actualiza solo) usamos un
**runner self-hosted de GitHub Actions**: un pequeño programa que corre en tu PC,
escucha cuando hacés `git push`, y ejecuta `docker compose up -d --build` localmente.
No hace falta SSH ni claves, porque el runner YA está en la misma máquina.

---

## PASO 1 — Instalar Docker Desktop

1. Descargá Docker Desktop para Windows: https://www.docker.com/products/docker-desktop/
2. Instalalo (te va a pedir habilitar WSL2 — aceptá, Docker lo hace automático).
3. Abrí Docker Desktop y esperá a que diga "Engine running".
4. Verificá en PowerShell:
   ```powershell
   docker --version
   docker compose version
   ```

---

## PASO 2 — Clonar el proyecto y levantarlo localmente

```powershell
git clone https://github.com/TU_USUARIO/todo-app-docker.git
cd todo-app-docker
copy .env.example .env
notepad .env        # completá una contraseña real en DB_PASSWORD
docker compose up -d --build
docker compose ps   # los 3 contenedores deben decir "running"
```

Entrá a `http://localhost` en el navegador — la app ya debería funcionar en tu PC.

---

## PASO 3 — Configurar el Firewall de Windows

Docker ya expone el puerto 80 en tu PC. Para que ese puerto esté controlado (y no
abierto a cualquier cosa), creamos una regla explícita:

1. Abrí **"Firewall de Windows Defender con seguridad avanzada"**.
2. Reglas de entrada → Nueva regla → Puerto → TCP → puerto específico **80**.
3. Permitir la conexión → aplicar a los 3 perfiles → nombre: "Todo-App HTTP".
4. (Opcional pero recomendado) Revisá que no tengas otros puertos innecesarios
   abiertos: Panel de control → Firewall → Reglas de entrada, y dejá solo lo que uses.

Esto cumple el mismo rol que UFW en un VPS Linux: controla explícitamente qué
puertos aceptan conexiones entrantes.

---

## PASO 4 — Exponer tu PC a Internet con Cloudflare Tunnel (sin cuenta, sin tarjeta)

1. Descargá `cloudflared` para Windows:
   https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. En PowerShell, dentro de la carpeta donde lo descargaste:
   ```powershell
   .\cloudflared.exe tunnel --url http://localhost:80
   ```
3. La terminal te va a mostrar una URL pública tipo:
   ```
   https://algo-random-generado.trycloudflare.com
   ```
   Esa URL ya es pública: cualquiera (tu docente incluido) puede entrar ahí y ver
   tu app funcionando, sin que hayas tocado el router ni pagado nada.

**Importante:** este tipo de túnel rápido ("quick tunnel") vive mientras la
ventana de `cloudflared` esté abierta. Para la entrega/demo en clase, alcanza con
tenerlo corriendo en ese momento. Si querés que sea permanente, se puede crear una
cuenta gratuita de Cloudflare y un túnel con nombre (no hace falta dominio propio,
Cloudflare te da uno gratis) — dejo el link de la documentación oficial arriba.

---

## PASO 5 — Configurar el runner self-hosted de GitHub Actions

1. En tu repo de GitHub: **Settings → Actions → Runners → New self-hosted runner**.
2. Elegí **Windows**. GitHub te va a mostrar comandos como estos (usá los que te
   muestre a vos, incluyen un token único):
   ```powershell
   mkdir actions-runner ; cd actions-runner
   Invoke-WebRequest -Uri https://github.com/actions/runner/releases/... -OutFile actions-runner.zip
   Expand-Archive -Path actions-runner.zip -DestinationPath .
   ./config.cmd --url https://github.com/TU_USUARIO/todo-app-docker --token TU_TOKEN
   ```
3. Cuando te pregunte el nombre del grupo de trabajo, dejá el default.
4. Instalalo como **servicio de Windows** para que quede corriendo siempre
   (te lo pregunta al final del config, o corré `./svc.cmd install` y
   `./svc.cmd start`).
5. Confirmá en GitHub (Settings → Actions → Runners) que aparece como **"Idle"**
   (en verde) — significa que está escuchando.

A partir de acá, el archivo `.github/workflows/deploy.yml` (ya incluido en el
proyecto y ajustado para correr en `self-hosted`) se dispara automáticamente en
cada push, directamente en tu PC.

---

## PASO 6 — Probar el CI/CD de punta a punta

En tu compu (puede ser la misma PC u otra), modificá algo del código y:
```powershell
git add .
git commit -m "Prueba de despliegue automático"
git push
```

Andá a la pestaña **Actions** de GitHub: vas a ver el job correr **en tu propia
PC** (dice "self-hosted" en el log), reconstruir los contenedores con Docker y
verificar que la app responda. Refrescá la URL de Cloudflare y vas a ver el
cambio reflejado — sin haber tocado nada a mano.

---

## PASO 7 — Backups automáticos con el Programador de Tareas

1. Abrí **"Programador de tareas"** (Task Scheduler) en Windows.
2. Crear tarea básica → nombre "Backup Todo-App" → Diariamente → 3:00 AM.
3. Acción: "Iniciar un programa".
   - Programa/script: `powershell.exe`
   - Argumentos: `-ExecutionPolicy Bypass -File "C:\ruta\completa\todo-app-docker\deploy\backup.ps1"`
4. Finalizar. El script usa `docker exec` para volcar la base de datos (ver
   `deploy/backup.ps1`) y guarda los respaldos comprimidos en `C:\todo-backups`,
   eliminando automáticamente los de más de 7 días.

---

## Qué contar en el informe

En la sección de infraestructura, reemplazá "VPS" por "host de despliegue
(PC personal administrada como servidor)", y explicá esta decisión: la falta de
tarjeta de crédito para contratar un VPS en la nube llevó a usar la propia PC como
servidor, exponiéndola con un túnel cifrado (Cloudflare Tunnel) en lugar de una IP
pública propia, manteniendo los mismos principios de administración (firewall,
usuarios/permisos dentro de Docker, backups programados y CI/CD real). Esta
arquitectura es una práctica legítima y muy usada para prototipos, demos y
laboratorios — es la misma razón por la que Cloudflare Tunnel existe.

## Diferencias respecto a la versión con VPS en la nube

| Aspecto | Con VPS (Oracle Cloud) | Sin VPS (tu PC) |
|---|---|---|
| Servidor | Instancia en la nube, 24/7 | Tu PC, mientras esté encendida |
| Acceso remoto para el pipeline | SSH + rsync | Runner self-hosted (sin SSH) |
| Exposición pública | IP pública propia | Túnel cifrado de Cloudflare |
| Firewall | UFW (Linux) | Firewall de Windows Defender |
| Backups | cron + `pg_dump` vía `docker exec` | Programador de tareas + `backup.ps1` |
| Disponibilidad | Siempre online | Solo mientras tu PC esté prendida y con `cloudflared` corriendo |
