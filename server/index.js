import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'centrova-os-dev-secret-key';
const hasDeletedAtCache = {}; // table -> boolean cache

// Helper: check if a table has a deleted_at column
async function tableHasDeletedAt(table) {
  if (hasDeletedAtCache[table] !== undefined) return hasDeletedAtCache[table];
  try {
    const [rows] = await pool.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'deleted_at'",
      [process.env.DB_NAME || 'centrova_os', table]
    );
    hasDeletedAtCache[table] = rows.length > 0;
    return hasDeletedAtCache[table];
  } catch {
    return false;
  }
}

// Helper: convert ISO datetime string to MySQL DATETIME format
function toMySqlDatetime(iso) {
  if (!iso) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
}

// Helper: recursively convert datetime values in an object
function convertDatetimes(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const dateFields = ['created_at', 'updated_at', 'deleted_at', 'createdAt', 'updatedAt', 'deletedAt'];
  for (const key of Object.keys(obj)) {
    if (dateFields.includes(key) && typeof obj[key] === 'string' && obj[key].includes('T')) {
      obj[key] = toMySqlDatetime(obj[key]);
    }
  }
  return obj;
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Auth middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ============================================================
// AUTH ENDPOINTS
// ============================================================

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, options } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing[0].length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    const fullName = options?.data?.full_name || '';

    await pool.query(
      'INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)',
      [id, email, passwordHash, fullName]
    );

    await pool.query(
      'INSERT INTO profiles (id, full_name, email) VALUES (?, ?, ?)',
      [id, fullName, email]
    );

    const token = jwt.sign({ id, email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      data: {
        user: { id, email, user_metadata: { full_name: fullName } },
        session: { access_token: token, user: { id, email } },
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/token
app.post('/api/auth/token', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      data: {
        user: { id: user.id, email: user.email, user_metadata: { full_name: user.full_name } },
        session: { access_token: token, user: { id: user.id, email: user.email } },
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/user
app.get('/api/auth/user', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, email, full_name, avatar_url FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];
    res.json({
      data: {
        user: { id: user.id, email: user.email, user_metadata: { full_name: user.full_name } },
      },
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', authenticate, (req, res) => {
  res.json({ data: {} });
});

// ============================================================
// DATABASE REST API
// ============================================================

// Helper: parse Supabase-style query params
function parseQuery(queryParams) {
  const { select, offset, limit, order } = queryParams;
  let fields = '*';
  let offsetVal = 0;
  let limitVal = 1000;
  let orderClause = '';
  let joins = [];

  if (select) {
    // Strip Supabase join syntax like `client:clients(company_name)` from SQL
    // Match pattern: alias:table_name(columns...) — commas inside parens are OK
    const joinRegex = /(\w+):(\w+)\(([^)]*)\)/g;
    let match;
    while ((match = joinRegex.exec(select)) !== null) {
      joins.push({ alias: match[1], refTable: match[2], refCols: match[3] });
    }
    // Remove all join patterns from the select string
    fields = select.replace(joinRegex, '').replace(/,(\s*,)+/g, ',').replace(/,\s*$/, '').replace(/^\s*,/, '').trim();
    if (!fields) fields = '*';
  }

  if (offset) offsetVal = parseInt(offset);
  if (limit) limitVal = parseInt(limit);
  if (order) {
    const parts = order.split(',');
    orderClause = parts.map(p => {
      const trimmed = p.trim();
      // Supabase format: column.asc or column.desc
      if (trimmed.includes('.')) {
        const [col, dir] = trimmed.split('.');
        return `${col} ${dir?.toLowerCase() === 'desc' ? 'DESC' : 'ASC'}`;
      }
      // Fallback: space-separated
      const [col, dir] = trimmed.split(/\s+/);
      return `${col} ${dir?.toLowerCase() === 'desc' ? 'DESC' : 'ASC'}`;
    }).join(', ');
  }

  return { fields, offsetVal, limitVal, orderClause, joins };
}

// Helper: build WHERE from Supabase filter params
function buildWhere(table, queryParams, extraUserFilter = false) {
  const clauses = [];
  const params = [];

  // Handle special Supabase filters like ?column=eq.value
  for (const [key, value] of Object.entries(queryParams)) {
    if (['select', 'offset', 'limit', 'order'].includes(key)) continue;

    // Check for operators: column=operator.value
    if (typeof value === 'string') {
      const match = value.match(/^(eq|neq|gt|gte|lt|lte|like|ilike|in|is)\.(.+)$/);
      if (match) {
        const [, op, val] = match;
        let realCol = key;

        // Handle nested joins like client:clients(company_name)
        if (key.includes(':')) {
          // Skip joins for now
          continue;
        }

        // Check if it's a nested key with parentheses
        if (key.includes('(')) {
          continue;
        }

        switch (op) {
          case 'eq':
            clauses.push(`${realCol} = ?`);
            params.push(val);
            break;
          case 'neq':
            clauses.push(`${realCol} != ?`);
            params.push(val);
            break;
          case 'gt':
            clauses.push(`${realCol} > ?`);
            params.push(val);
            break;
          case 'gte':
            clauses.push(`${realCol} >= ?`);
            params.push(val);
            break;
          case 'lt':
            clauses.push(`${realCol} < ?`);
            params.push(val);
            break;
          case 'lte':
            clauses.push(`${realCol} <= ?`);
            params.push(val);
            break;
          case 'like':
            clauses.push(`${realCol} LIKE ?`);
            params.push(val);
            break;
          case 'ilike':
            clauses.push(`${realCol} LIKE ?`);
            params.push(val);
            break;
          case 'is':
            if (val === 'null') {
              clauses.push(`${realCol} IS NULL`);
            } else if (val === 'not.null') {
              clauses.push(`${realCol} IS NOT NULL`);
            } else {
              clauses.push(`${realCol} = ?`);
              params.push(val);
            }
            break;
          case 'in':
            clauses.push(`${realCol} IN (${val.split(',').map(() => '?').join(',')})`);
            params.push(...val.split(','));
            break;
        }
      } else {
        // Plain value - treat as eq
        clauses.push(`${key} = ?`);
        params.push(value);
      }
    } else if (typeof value === 'object' && value !== null) {
      // Handle object filters
      for (const [op, val] of Object.entries(value)) {
        const realCol = key;
        switch (op) {
          case 'eq':
            clauses.push(`${realCol} = ?`);
            params.push(val);
            break;
          case 'neq':
            clauses.push(`${realCol} != ?`);
            params.push(val);
            break;
          case 'in':
            clauses.push(`${realCol} IN (${val.map(() => '?').join(',')})`);
            params.push(...val);
            break;
        }
      }
    }
  }

  // Handle soft delete
  if (queryParams['deleted_at'] === undefined) {
    // Check if table has deleted_at column
    // We'll let each query handle this
  }

  const whereStr = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return { whereStr, params };
}

// GET /api/rest/v1/:table
app.get('/api/rest/v1/:table', authenticate, async (req, res) => {
  try {
    const { table } = req.params;
    const { fields, offsetVal, limitVal, orderClause, joins } = parseQuery(req.query);
    const { whereStr, params } = buildWhere(table, req.query);

    // Only auto-add deleted_at IS NULL if the table has that column
    let finalWhere = whereStr;
    const hasDeletedKey = Object.keys(req.query).some(k => k === 'deleted_at');
    if (!hasDeletedKey) {
      const hasCol = await tableHasDeletedAt(table);
      if (hasCol) {
        finalWhere = whereStr ? `${whereStr} AND deleted_at IS NULL` : 'WHERE deleted_at IS NULL';
      }
    }

    const orderBy = orderClause ? `ORDER BY ${orderClause}` : '';
    const sql = `SELECT ${fields} FROM ${table} ${finalWhere} ${orderBy} LIMIT ? OFFSET ?`;
    const [rows] = await pool.query(sql, [...params, limitVal, offsetVal]);

    // Handle joins from select query (e.g. `client:clients(company_name)`)
    if (joins.length > 0 && rows.length > 0) {
      for (const { alias, refTable, refCols } of joins) {
        for (const row of rows) {
          // Try both `alias` and `alias_id` as the FK column
          const fkValue = row[alias] || row[`${alias}_id`];
          if (fkValue) {
            const [refRows] = await pool.query(
              `SELECT ${refCols} FROM ${refTable} WHERE id = ?`,
              [fkValue]
            );
            row[alias] = refRows[0] || null;
            // Remove the raw FK column if it was aliased
            if (row[`${alias}_id`] && !row[alias]) {
              // keep both
            }
          }
        }
      }
    }

    res.json(rows);
  } catch (err) {
    console.error(`GET /api/rest/v1/${req.params.table} error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rest/v1/:table (Insert - single or batch)
app.post('/api/rest/v1/:table', authenticate, async (req, res) => {
  try {
    const { table } = req.params;
    const body = req.body;

    // Handle both single object and array of objects (batch insert)
    const items = Array.isArray(body) ? body : [body];

    const insertedIds = [];
    for (const item of items) {
      let data = convertDatetimes({ ...item });
      if (!data.id) data.id = uuidv4();

      // Stringify any object values (e.g. JSON columns, arrays)
      for (const key of Object.keys(data)) {
        if (typeof data[key] === 'object' && data[key] !== null && !(data[key] instanceof String)) {
          data[key] = JSON.stringify(data[key]);
        }
      }

      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = columns.map(() => '?').join(', ');

      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
      await pool.query(sql, values);
      insertedIds.push(data.id);
    }

    // Return inserted rows
    if (insertedIds.length === 1) {
      const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [insertedIds[0]]);
      res.status(201).json(rows.length === 1 ? rows[0] : rows);
    } else {
      const placeholders = insertedIds.map(() => '?').join(',');
      const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id IN (${placeholders}) ORDER BY created_at`, insertedIds);
      res.status(201).json(rows);
    }
  } catch (err) {
    console.error(`POST /api/rest/v1/${req.params.table} error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/rest/v1/:table (Update)
app.patch('/api/rest/v1/:table', authenticate, async (req, res) => {
  try {
    const { table } = req.params;
    let data = convertDatetimes(req.body);

    // Stringify any object values
    for (const key of Object.keys(data)) {
      if (typeof data[key] === 'object' && data[key] !== null && !(data[key] instanceof String)) {
        data[key] = JSON.stringify(data[key]);
      }
    }
    const { whereStr, params } = buildWhere(table, req.query);

    if (!whereStr) {
      return res.status(400).json({ error: 'WHERE clause required for update' });
    }

    // Remove id from updates if present
    if (data.id) delete data.id;

    const setClauses = Object.keys(data).map(k => `${k} = ?`);
    const setValues = Object.values(data);

    const sql = `UPDATE ${table} SET ${setClauses.join(', ')} ${whereStr}`;
    await pool.query(sql, [...setValues, ...params]);

    // Return updated rows
    const [rows] = await pool.query(`SELECT * FROM ${table} ${whereStr}`, params);
    res.json(rows);
  } catch (err) {
    console.error(`PATCH /api/rest/v1/${req.params.table} error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/rest/v1/:table (Soft delete or hard delete)
app.delete('/api/rest/v1/:table', authenticate, async (req, res) => {
  try {
    const { table } = req.params;
    const { whereStr, params } = buildWhere(table, req.query);

    if (!whereStr) {
      return res.status(400).json({ error: 'WHERE clause required for delete' });
    }

    // Check if table has deleted_at for soft delete
    const hasDeleted = await tableHasDeletedAt(table);
    if (hasDeleted) {
      await pool.query(`UPDATE ${table} SET deleted_at = NOW() ${whereStr}`, params);
    } else {
      await pool.query(`DELETE FROM ${table} ${whereStr}`, params);
    }

    res.json({ data: {} });
  } catch (err) {
    console.error(`DELETE /api/rest/v1/${req.params.table} error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// RPC ENDPOINTS
// ============================================================

// POST /api/rpc/v1/get_next_invoice_number
app.post('/api/rpc/v1/get_next_invoice_number', authenticate, async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    // Insert a row to generate next sequence number
    const [result] = await pool.query(
      'INSERT INTO invoice_number_seq (created_at) VALUES (NOW())'
    );
    const seq = result.insertId;

    const invoiceNumber = `INV/${year}${month}/${String(seq).padStart(4, '0')}`;

    res.json({ data: invoiceNumber });
  } catch (err) {
    console.error('get_next_invoice_number error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// STORAGE ENDPOINTS
// ============================================================

// POST /api/storage/v1/object/:bucket
app.post('/api/storage/v1/object/:bucket', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { bucket } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const publicUrl = `/uploads/${req.file.filename}`;
    res.json({
      data: { Id: req.file.filename, fullPath: `${bucket}/${req.file.filename}`, publicUrl },
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/storage/v1/object/public/:bucket/:filename
app.get('/api/storage/v1/object/public/:bucket/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, 'uploads', filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// DELETE /api/storage/v1/object/:bucket
app.delete('/api/storage/v1/object/:bucket', authenticate, async (req, res) => {
  try {
    const files = req.body?.prefixes || req.body || [];
    for (const f of files) {
      const filename = path.basename(f);
      const filePath = path.join(__dirname, 'uploads', filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.json({ data: {} });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// AI CHAT PROXY (simple echo for now)
// ============================================================
app.post('/api/functions/v1/ai-chat', authenticate, async (req, res) => {
  try {
    const { message, history } = req.body;
    // Simple echo response for now
    res.json({
      message: `AI Chat is ready. You said: "${message?.substring(0, 100)}"`,
    });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Centrova OS Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
