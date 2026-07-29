// server.js - API REST para la To-Do List
// Stack: Node.js + Express + PostgreSQL

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Validación de variables de entorno obligatorias ---
// Antes el server arrancaba con credenciales por defecto ('todo_password')
// si faltaba el .env. Eso es un riesgo: si alguien olvida configurar el
// .env en el VPS, queda corriendo con una contraseña conocida y pública
// (está en este mismo repo). Mejor fallar rápido y avisar.
const requiredEnv = ['DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`Faltan variables de entorno obligatorias: ${missingEnv.join(', ')}`);
  console.error('Configurá el archivo .env (ver .env.example) antes de arrancar el server.');
  process.exit(1);
}

// --- Seguridad HTTP básica ---
app.disable('x-powered-by'); // no anunciar que corremos Express
app.use(helmet());

// --- CORS restringido ---
// cors() sin opciones acepta pedidos desde CUALQUIER origen. Como el
// frontend siempre habla con el backend a través del proxy de Nginx
// (mismo origen), no hace falta abrirlo a todos. Se puede configurar
// un origen extra por variable de entorno si hiciera falta (ej. para
// desarrollo local).
const allowedOrigins = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Sin header Origin (ej. curl, health checks, mismo origen vía proxy) -> permitir
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS'));
  },
}));

app.use(express.json({ limit: '10kb' })); // límite de tamaño de body, evita payloads gigantes

// --- Rate limiting ---
// Evita fuerza bruta / abuso básico contra la API (DoS liviano, scraping agresivo, etc.)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // 100 requests por IP por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intentá de nuevo en un momento' },
});
app.use('/api/', apiLimiter);

// Conexión a PostgreSQL usando variables de entorno (ver .env.example)
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Verificación de conexión al arrancar
pool.connect()
  .then((client) => {
    console.log('Conectado a PostgreSQL correctamente');
    client.release();
  })
  .catch((err) => {
    console.error('Error al conectar a PostgreSQL:', err.message);
  });

const MAX_TITLE_LENGTH = 255; // coincide con VARCHAR(255) en la base

function isValidTitle(title) {
  return typeof title === 'string' && title.trim().length > 0 && title.trim().length <= MAX_TITLE_LENGTH;
}

// Endpoint de salud (útil para monitoreo y para el pipeline de CI/CD)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// LISTAR (con soporte de filtro por query ?q=texto)
app.get('/api/tasks', async (req, res) => {
  try {
    let { q } = req.query;
    if (q !== undefined) {
      if (typeof q !== 'string' || q.length > MAX_TITLE_LENGTH) {
        return res.status(400).json({ error: 'Parámetro de búsqueda inválido' });
      }
    }
    let result;
    if (q) {
      // Consulta parametrizada: el valor de q nunca se concatena en el SQL,
      // así que no hay riesgo de inyección SQL.
      result = await pool.query(
        'SELECT * FROM tasks WHERE title ILIKE $1 ORDER BY created_at DESC',
        [`%${q}%`]
      );
    } else {
      result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar tareas' });
  }
});

// INSERTAR
app.post('/api/tasks', async (req, res) => {
  try {
    const { title } = req.body;
    if (!isValidTitle(title)) {
      return res.status(400).json({ error: `El título es obligatorio (máx. ${MAX_TITLE_LENGTH} caracteres)` });
    }
    const result = await pool.query(
      'INSERT INTO tasks (title, completed) VALUES ($1, false) RETURNING *',
      [title.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al insertar tarea' });
  }
});

// ACTUALIZAR (título y/o estado completado)
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const { title, completed } = req.body;
    if (title !== undefined && !isValidTitle(title)) {
      return res.status(400).json({ error: `Título inválido (máx. ${MAX_TITLE_LENGTH} caracteres)` });
    }
    if (completed !== undefined && typeof completed !== 'boolean') {
      return res.status(400).json({ error: 'El campo completed debe ser booleano' });
    }
    const result = await pool.query(
      `UPDATE tasks SET
        title = COALESCE($1, title),
        completed = COALESCE($2, completed)
       WHERE id = $3 RETURNING *`,
      [title !== undefined ? title.trim() : null, completed, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar tarea' });
  }
});

// ELIMINAR
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    res.json({ message: 'Tarea eliminada', task: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar tarea' });
  }
});

// 404 genérico para cualquier otra ruta de la API
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado' });
});

app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en el puerto ${PORT}`);
});
