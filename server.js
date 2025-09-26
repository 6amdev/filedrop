const express = require('express');
const multer = require('multer');
const redis = require('redis');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const chalk = require('chalk');
const chokidar = require('chokidar');
const crypto = require('crypto');
const session = require('express-session');

// Load configuration
let config;
try {
  config = require('./config.json');
} catch (error) {
  console.error(chalk.red('❌ config.json not found!'));
  console.log(chalk.yellow('Please create config.json file'));
  process.exit(1);
}

const app = express();
const PORT = config.server.port || 3000;
const UPLOAD_PATH = config.server.uploadPath || './uploads';
const CLEANUP_CONFIG = config.cleanup || {
  deleteAfterDownload: false,
  keepFilesForDays: 7,
  autoCleanupInterval: 24
};

// Authentication config
const AUTH_CONFIG = config.auth || {
  enabled: false,
  username: 'admin',
  passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', // 'admin123'
  apiKey: 'filedrop-api-key-2024' // Default API key for clients
};

// ASCII Banner
console.log(chalk.cyan(`
 ███████╗██╗██╗     ███████╗██████╗ ██████╗  ██████╗ ██████╗ 
 ██╔════╝██║██║     ██╔════╝██╔══██╗██╔══██╗██╔═══██╗██╔══██╗
 █████╗  ██║██║     █████╗  ██║  ██║██████╔╝██║   ██║██████╔╝
 ██╔══╝  ██║██║     ██╔══╝  ██║  ██║██╔══██╗██║   ██║██╔═══╝ 
 ██║     ██║███████╗███████╗██████╔╝██║  ██║╚██████╔╝██║     
 ╚═╝     ╚═╝╚══════╝╚══════╝╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝     
                                                              
            🚀 FileDrop Server v2.1 - Fixed Upload Issues     
`));

// Redis client
const redisClient = redis.createClient({
  host: 'localhost',
  port: 6379
});

redisClient.on('error', (err) => {
  console.log(chalk.red('❌ Redis Error:'), err.message);
  console.log(chalk.yellow('💡 Make sure Redis is running:'));
  console.log(chalk.white('   redis-server'));
});

redisClient.on('connect', () => {
  console.log(chalk.green('✅ Connected to Redis'));
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '1000mb' }));
app.use(express.urlencoded({ limit: '1000mb', extended: true }));
app.use(express.static('./'));

// Session middleware (if auth is enabled)
if (AUTH_CONFIG.enabled) {
  app.use(session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));
}

// Create upload directory
if (!fs.existsSync(UPLOAD_PATH)) {
  fs.mkdirSync(UPLOAD_PATH, { recursive: true });
}

// Improved Multer setup - แก้ปัญหา Unexpected end of form
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_PATH);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const fileName = `${timestamp}___${file.originalname}`;
    cb(null, fileName);
  }
});

const upload = multer({ 
  storage,
  limits: { 
    fileSize: 500 * 1024 * 1024, // 500MB per file
    files: 20,                   // Max 20 files
    fields: 20,                  // Max form fields
    parts: 100                   // Max parts in multipart
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types but log them
    logWithTime(`📎 Processing file: ${file.originalname} (${file.mimetype})`, 'info');
    cb(null, true);
  }
});

// Utility functions
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Authentication functions
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function isAuthenticated(req, res, next) {
  if (!AUTH_CONFIG.enabled) {
    return next(); // Skip auth if disabled
  }
  
  // Check for API key in headers (for clients)
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === AUTH_CONFIG.apiKey) {
    return next();
  }
  
  // Check for session (for web users)
  if (req.session && req.session.authenticated) {
    return next();
  }
  
  // For API calls, return JSON error
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required. Use X-API-Key header or web login.' });
  }
  
  // For web pages, redirect to login
  res.redirect('/login');
}

// ฟังก์ชั่นสำหรับแยก timestamp กับชื่อไฟล์
function extractOriginalFilename(storedFilename) {
  const parts = storedFilename.split('___');
  if (parts.length >= 2) {
    return parts.slice(1).join('___');
  }
  return storedFilename;
}

// File cleanup functions
async function deleteFileAfterDownload(filePath, originalName) {
  if (CLEANUP_CONFIG.deleteAfterDownload && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      logWithTime(`🗑️  File deleted: ${originalName}`, 'info');
    } catch (error) {
      logWithTime(`❌ Failed to delete file: ${error.message}`, 'error');
    }
  }
}

async function cleanupOldFiles() {
  try {
    const files = fs.readdirSync(UPLOAD_PATH);
    const now = Date.now();
    const maxAge = CLEANUP_CONFIG.keepFilesForDays * 24 * 60 * 60 * 1000;
    
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(UPLOAD_PATH, file);
      try {
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (deletedCount > 0) {
      logWithTime(`🗑️  Auto cleanup: deleted ${deletedCount} old files (>${CLEANUP_CONFIG.keepFilesForDays} days)`, 'info');
    }
  } catch (error) {
    logWithTime(`❌ Auto cleanup error: ${error.message}`, 'error');
  }
}

function logWithTime(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red
  };
  console.log(`[${timestamp}] ${colors[type](message)}`);
}

// File Watcher Setup
async function setupFileWatcher() {
  console.log(chalk.blue('📁 Setting up file watcher...'));
  
  const watcher = chokidar.watch(UPLOAD_PATH, {
    ignored: /^\./,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100
    }
  });

  watcher
    .on('add', async (filePath) => {
      try {
        const fileName = path.basename(filePath);
        
        if (fileName.includes('___')) {
          return;
        }
        
        const stats = fs.statSync(filePath);
        const timestamp = Date.now();
        const newFileName = `${timestamp}___${fileName}`;
        const newFilePath = path.join(UPLOAD_PATH, newFileName);
        
        fs.renameSync(filePath, newFilePath);
        
        const job = {
          id: uuidv4(),
          originalName: fileName,
          fileName: newFileName,
          size: stats.size,
          uploadedAt: new Date().toISOString(),
          status: 'pending'
        };

        await redisClient.lPush('filedrop_queue', JSON.stringify(job));
        
        logWithTime(`📥 File detected: ${fileName} (${formatFileSize(stats.size)})`, 'success');
        
      } catch (error) {
        logWithTime(`❌ File watcher error: ${error.message}`, 'error');
      }
    });

  console.log(chalk.green('✅ File watcher monitoring:'), UPLOAD_PATH);
}

// Health check endpoint (ไม่ต้อง auth)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication Routes

// Login page (ไม่ต้อง auth)
app.get('/login', (req, res) => {
  if (!AUTH_CONFIG.enabled) {
    return res.redirect('/upload');
  }
  
  if (req.session && req.session.authenticated) {
    return res.redirect('/upload');
  }
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>FileDrop Login</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * {
                box-sizing: border-box;
            }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background-attachment: fixed;
            }
            .login-container {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                padding: 2.5rem;
                border-radius: 20px;
                box-shadow: 
                    0 20px 40px rgba(0,0,0,0.1),
                    0 0 0 1px rgba(255,255,255,0.2);
                width: 100%;
                max-width: 420px;
                animation: slideUp 0.6s ease-out;
            }
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            .logo {
                text-align: center;
                margin-bottom: 2.5rem;
            }
            .logo h1 {
                color: #333;
                font-size: 2.2rem;
                margin: 0 0 0.5rem 0;
                font-weight: 700;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            .logo p {
                color: #666;
                margin: 0;
                font-size: 1rem;
                font-weight: 500;
            }
            .form-group {
                margin-bottom: 1.8rem;
                position: relative;
            }
            label {
                display: block;
                margin-bottom: 0.8rem;
                color: #333;
                font-weight: 600;
                font-size: 0.95rem;
            }
            input[type="text"], input[type="password"] {
                width: 100%;
                padding: 15px 20px;
                border: 2px solid #e8ecf0;
                border-radius: 12px;
                font-size: 16px;
                transition: all 0.3s ease;
                background: rgba(255, 255, 255, 0.8);
                backdrop-filter: blur(5px);
            }
            input[type="text"]:focus, input[type="password"]:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                transform: translateY(-2px);
            }
            .btn-login {
                width: 100%;
                padding: 15px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            .btn-login:before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                transition: left 0.5s;
            }
            .btn-login:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
            }
            .btn-login:hover:before {
                left: 100%;
            }
            .btn-login:active {
                transform: translateY(0);
            }
            .error {
                color: #e74c3c;
                text-align: center;
                margin: 1.5rem 0;
                padding: 15px;
                background: rgba(231, 76, 60, 0.1);
                border-radius: 10px;
                border: 1px solid rgba(231, 76, 60, 0.2);
                animation: shake 0.5s ease-in-out;
                backdrop-filter: blur(5px);
            }
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-8px); }
                75% { transform: translateX(8px); }
            }
            .footer {
                text-align: center;
                margin-top: 2rem;
                color: #888;
                font-size: 0.85rem;
            }
            .decorative-elements {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: -1;
                overflow: hidden;
            }
            .decorative-elements::before {
                content: '';
                position: absolute;
                top: -50%;
                right: -20%;
                width: 300px;
                height: 300px;
                background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
                border-radius: 50%;
                animation: float 6s ease-in-out infinite;
            }
            .decorative-elements::after {
                content: '';
                position: absolute;
                bottom: -30%;
                left: -10%;
                width: 200px;
                height: 200px;
                background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
                border-radius: 50%;
                animation: float 4s ease-in-out infinite reverse;
            }
            @keyframes float {
                0%, 100% { transform: translateY(0px) rotate(0deg); }
                50% { transform: translateY(-20px) rotate(5deg); }
            }
            
            /* Mobile Responsive */
            @media (max-width: 768px) {
                body {
                    padding: 15px;
                }
                .login-container {
                    padding: 2rem;
                    border-radius: 16px;
                    margin: 20px 0;
                }
                .logo h1 {
                    font-size: 2rem;
                }
                .logo p {
                    font-size: 0.9rem;
                }
                input[type="text"], input[type="password"] {
                    padding: 14px 18px;
                    font-size: 16px; /* Prevent zoom on iOS */
                }
                .btn-login {
                    padding: 14px;
                    font-size: 16px;
                }
            }
            
            @media (max-width: 480px) {
                body {
                    padding: 10px;
                }
                .login-container {
                    padding: 1.5rem;
                    border-radius: 14px;
                }
                .logo h1 {
                    font-size: 1.8rem;
                }
                .form-group {
                    margin-bottom: 1.5rem;
                }
                input[type="text"], input[type="password"] {
                    padding: 12px 16px;
                }
                .btn-login {
                    padding: 12px;
                }
            }
            
            @media (max-width: 320px) {
                .login-container {
                    padding: 1.2rem;
                }
                .logo h1 {
                    font-size: 1.6rem;
                }
            }
            
            /* Landscape mobile */
            @media (max-height: 600px) and (orientation: landscape) {
                body {
                    align-items: flex-start;
                    padding-top: 20px;
                }
                .login-container {
                    margin: 20px 0;
                }
                .logo {
                    margin-bottom: 1.5rem;
                }
                .form-group {
                    margin-bottom: 1.2rem;
                }
            }
        </style>
    </head>
    <body>
        <div class="decorative-elements"></div>
        <div class="login-container">
            <div class="logo">
                <h1>🚀 FileDrop</h1>
                <p>Secure File Management System</p>
            </div>
            
            ${req.query.error ? `<div class="error">❌ Invalid username or password</div>` : ''}
            
            <form method="POST" action="/api/login">
                <div class="form-group">
                    <label for="username">👤 Username</label>
                    <input type="text" id="username" name="username" required autocomplete="username" placeholder="Enter your username">
                </div>
                
                <div class="form-group">
                    <label for="password">🔒 Password</label>
                    <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="Enter your password">
                </div>
                
                <button type="submit" class="btn-login">🔐 Sign In</button>
            </form>
            
            <div class="footer">
                <p>FileDrop Server v2.1 - Secure File Transfer</p>
            </div>
        </div>
    </body>
    </html>
  `);
});

// Login API (ไม่ต้อง auth)
app.post('/api/login', (req, res) => {
  if (!AUTH_CONFIG.enabled) {
    return res.redirect('/upload');
  }
  
  const { username, password } = req.body;
  
  if (username === AUTH_CONFIG.username && hashPassword(password) === AUTH_CONFIG.passwordHash) {
    req.session.authenticated = true;
    req.session.username = username;
    
    logWithTime(`✅ User logged in: ${username}`, 'success');
    res.redirect('/upload');
  } else {
    logWithTime(`❌ Failed login attempt: ${username}`, 'warning');
    res.redirect('/login?error=1');
  }
});

// Logout API
app.post('/api/logout', (req, res) => {
  if (req.session) {
    const username = req.session.username || 'unknown';
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Could not log out' });
      }
      logWithTime(`👋 User logged out: ${username}`, 'info');
      res.redirect('/login');
    });
  } else {
    res.redirect('/login');
  }
});

// API Routes (Protected)

// 1. Upload file - Fixed version with better error handling
app.post('/api/upload', isAuthenticated, (req, res) => {
  // Set longer timeout for large files
  req.setTimeout(10 * 60 * 1000); // 10 minutes
  res.setTimeout(10 * 60 * 1000);

  const uploadMiddleware = upload.array('files', 20);
  
  uploadMiddleware(req, res, async function (err) {
    if (err) {
      logWithTime(`❌ Upload error: ${err.message}`, 'error');
      
      if (err instanceof multer.MulterError) {
        switch (err.code) {
          case 'LIMIT_FILE_SIZE':
            return res.status(400).json({ 
              error: 'File too large (maximum 500MB per file)',
              code: 'FILE_TOO_LARGE'
            });
          case 'LIMIT_FILE_COUNT':
            return res.status(400).json({ 
              error: 'Too many files (maximum 20 files)',
              code: 'TOO_MANY_FILES'
            });
          case 'LIMIT_PART_COUNT':
            return res.status(400).json({ 
              error: 'Too many parts in request',
              code: 'TOO_MANY_PARTS'
            });
          case 'LIMIT_FIELD_COUNT':
            return res.status(400).json({ 
              error: 'Too many fields in form',
              code: 'TOO_MANY_FIELDS'
            });
          case 'LIMIT_UNEXPECTED_FILE':
            return res.status(400).json({ 
              error: 'Unexpected field name',
              code: 'UNEXPECTED_FIELD'
            });
          default:
            return res.status(400).json({ 
              error: `Upload error: ${err.message}`,
              code: 'MULTER_ERROR'
            });
        }
      }
      
      // Handle busboy errors (like "Unexpected end of form")
      if (err.message.includes('Unexpected end of form') || err.message.includes('Multipart')) {
        return res.status(400).json({ 
          error: 'Invalid form data - please try uploading again',
          code: 'INVALID_FORM_DATA',
          hint: 'This usually happens when upload is interrupted. Please try again.'
        });
      }
      
      return res.status(500).json({ 
        error: 'Upload failed - server error',
        code: 'SERVER_ERROR'
      });
    }
    
    // Process successful upload
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ 
          error: 'No files were uploaded',
          code: 'NO_FILES'
        });
      }

      const jobs = [];
      
      for (const file of req.files) {
        const originalName = extractOriginalFilename(file.filename);
        
        const job = {
          id: uuidv4(),
          originalName: originalName,
          fileName: file.filename,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          status: 'pending'
        };

        await redisClient.lPush('filedrop_queue', JSON.stringify(job));
        jobs.push(job);
        
        logWithTime(`📤 File uploaded: ${originalName} (${formatFileSize(job.size)})`, 'success');
      }
      
      res.json({
        success: true,
        message: `${jobs.length} file(s) uploaded successfully`,
        count: jobs.length,
        jobs: jobs.map(job => ({
          id: job.id,
          fileName: job.originalName,
          size: formatFileSize(job.size),
          uploadedAt: job.uploadedAt
        }))
      });

    } catch (error) {
      logWithTime(`❌ Processing error: ${error.message}`, 'error');
      res.status(500).json({ 
        error: 'Failed to process uploaded files',
        code: 'PROCESSING_ERROR'
      });
    }
  });
});

// 2. Get pending jobs
app.get('/api/jobs/pending', isAuthenticated, async (req, res) => {
  try {
    const jobs = [];
    const queueLength = await redisClient.lLen('filedrop_queue');
    
    for (let i = 0; i < Math.min(queueLength, 50); i++) {
      const jobData = await redisClient.lIndex('filedrop_queue', i);
      if (jobData) {
        jobs.push(JSON.parse(jobData));
      }
    }

    res.json({ 
      success: true,
      jobs, 
      count: jobs.length,
      totalInQueue: queueLength
    });

  } catch (error) {
    logWithTime(`❌ Get jobs error: ${error.message}`, 'error');
    res.status(500).json({ 
      error: 'Failed to get jobs',
      code: 'GET_JOBS_ERROR'
    });
  }
});

// 3. Download file with original filename
app.get('/api/download/:jobId', isAuthenticated, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const queueLength = await redisClient.lLen('filedrop_queue');
    let targetJob = null;
    
    for (let i = 0; i < queueLength; i++) {
      const jobData = await redisClient.lIndex('filedrop_queue', i);
      if (jobData) {
        const job = JSON.parse(jobData);
        if (job.id === jobId) {
          targetJob = job;
          break;
        }
      }
    }

    if (!targetJob) {
      return res.status(404).json({ 
        error: 'Job not found',
        code: 'JOB_NOT_FOUND'
      });
    }

    const filePath = path.join(UPLOAD_PATH, targetJob.fileName);
    
    if (!fs.existsSync(filePath)) {
      await redisClient.lRem('filedrop_queue', 1, JSON.stringify(targetJob));
      logWithTime(`🗑️  Removed stale job: ${targetJob.originalName}`, 'warning');
      return res.status(404).json({ 
        error: 'File no longer exists',
        code: 'FILE_NOT_FOUND'
      });
    }

    logWithTime(`📥 File downloaded: ${targetJob.originalName}`, 'info');
    
    res.download(filePath, targetJob.originalName);

  } catch (error) {
    logWithTime(`❌ Download error: ${error.message}`, 'error');
    res.status(500).json({ 
      error: 'Download failed',
      code: 'DOWNLOAD_ERROR'
    });
  }
});

// 4. Complete job
app.post('/api/jobs/:jobId/complete', isAuthenticated, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const queueLength = await redisClient.lLen('filedrop_queue');
    
    for (let i = 0; i < queueLength; i++) {
      const jobData = await redisClient.lIndex('filedrop_queue', i);
      if (jobData) {
        const job = JSON.parse(jobData);
        if (job.id === jobId) {
          await redisClient.lRem('filedrop_queue', 1, jobData);
          
          job.completedAt = new Date().toISOString();
          await redisClient.lPush('filedrop_completed', JSON.stringify(job));
          
          const filePath = path.join(UPLOAD_PATH, job.fileName);
          await deleteFileAfterDownload(filePath, job.originalName);
          
          logWithTime(`✅ Job completed: ${job.originalName}`, 'success');
          
          return res.json({ 
            success: true,
            message: 'Job completed',
            job: {
              id: job.id,
              fileName: job.originalName,
              completedAt: job.completedAt
            }
          });
        }
      }
    }

    res.status(404).json({ 
      error: 'Job not found',
      code: 'JOB_NOT_FOUND'
    });

  } catch (error) {
    logWithTime(`❌ Complete job error: ${error.message}`, 'error');
    res.status(500).json({ 
      error: 'Failed to complete job',
      code: 'COMPLETE_JOB_ERROR'
    });
  }
});

// 5. Server status
app.get('/api/status', isAuthenticated, async (req, res) => {
  try {
    const pendingCount = await redisClient.lLen('filedrop_queue');
    const completedCount = await redisClient.lLen('filedrop_completed');
    
    res.json({
      success: true,
      status: 'running',
      version: '2.1.0',
      uptime: Math.floor(process.uptime()),
      pending: pendingCount,
      completed: completedCount,
      uploadPath: UPLOAD_PATH,
      fileWatcher: 'active',
      filenameHandling: 'original_names_preserved',
      authEnabled: AUTH_CONFIG.enabled,
      currentUser: req.session?.username || null,
      limits: {
        maxFileSize: '500MB',
        maxFiles: 20,
        timeout: '10 minutes'
      }
    });
  } catch (error) {
    logWithTime(`❌ Status check error: ${error.message}`, 'error');
    res.status(500).json({ 
      error: 'Status check failed',
      code: 'STATUS_ERROR'
    });
  }
});

// Main upload page (Protected)
app.get('/upload', isAuthenticated, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>FileDrop Server - Upload</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0;
                padding: 20px;
                min-height: 100vh;
            }
            .container {
                max-width: 900px;
                margin: 0 auto;
                background: white;
                border-radius: 15px;
                padding: 2rem;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 2rem;
            }
            .header h1 {
                color: #333;
                font-size: 2.5rem;
                margin: 0;
            }
            .header p {
                color: #666;
                margin: 0.5rem 0;
            }
            .button-group {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            .logout-btn {
                background: #6c757d;
                color: white;
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                text-decoration: none;
                font-size: 16px;
                font-weight: 600;
                transition: all 0.2s;
                order: 999; /* ให้อยุ่สุดท้าย */
            }
            .logout-btn:hover {
                background: #5a6268;
                transform: translateY(-2px);
            }
            .status-bar {
                background: #d4edda;
                color: #155724;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 2rem;
                border: 1px solid #c3e6cb;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .upload-area {
                border: 3px dashed #ddd;
                border-radius: 15px;
                padding: 3rem 2rem;
                text-align: center;
                margin-bottom: 2rem;
                transition: all 0.3s ease;
                background: #fafafa;
            }
            .upload-area:hover {
                border-color: #667eea;
                background: #f0f4ff;
            }
            .upload-area.drag-over {
                border-color: #667eea;
                background: #e3f2fd;
                transform: scale(1.02);
            }
            .upload-icon {
                font-size: 4rem;
                color: #667eea;
                margin-bottom: 1rem;
            }
            .upload-text {
                font-size: 1.2rem;
                color: #333;
                margin-bottom: 1rem;
            }
            .upload-subtext {
                color: #666;
                font-size: 0.9rem;
                margin-bottom: 2rem;
            }
            .mobile-warning {
                background: #fff3cd;
                color: #856404;
                padding: 12px;
                border-radius: 8px;
                border: 1px solid #ffeaa7;
                margin: 15px 0;
                font-size: 0.9rem;
                text-align: center;
                line-height: 1.4;
            }
            .file-input {
                display: none;
            }
            .btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-weight: 600;
                transition: transform 0.2s;
                margin: 5px;
            }
            .btn:hover {
                transform: translateY(-2px);
            }
            .btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            .btn-secondary {
                background: #6c757d;
            }
            .btn-danger {
                background: #dc3545;
            }
            .progress-container {
                margin: 20px 0;
                display: none;
            }
            .progress-bar {
                width: 100%;
                height: 25px;
                background: #e9ecef;
                border-radius: 15px;
                overflow: hidden;
                position: relative;
            }
            .progress-fill {
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                width: 0%;
                transition: width 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 0.9rem;
            }
            .file-list {
                margin-top: 20px;
                text-align: left;
            }
            .file-item {
                background: #f8f9fa;
                padding: 15px;
                margin: 8px 0;
                border-radius: 8px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-left: 4px solid #667eea;
            }
            .file-info {
                flex-grow: 1;
            }
            .file-name {
                font-weight: 600;
                color: #333;
            }
            .file-size {
                font-size: 0.9rem;
                color: #666;
            }
            .status-success {
                color: #28a745;
                font-weight: bold;
                background: #d4edda;
                padding: 15px;
                border-radius: 8px;
                border: 1px solid #c3e6cb;
                animation: slideIn 0.5s ease;
            }
            .status-error {
                color: #dc3545;
                font-weight: bold;
                background: #f8d7da;
                padding: 15px;
                border-radius: 8px;
                border: 1px solid #f5c6cb;
                animation: slideIn 0.5s ease;
            }
            .status-warning {
                color: #856404;
                font-weight: bold;
                background: #fff3cd;
                padding: 15px;
                border-radius: 8px;
                border: 1px solid #ffeaa7;
                animation: slideIn 0.5s ease;
            }
            @keyframes slideIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .file-counter {
                font-size: 1.1rem;
                font-weight: bold;
                margin-bottom: 15px;
                color: #667eea;
            }
            .limits-info {
                font-size: 0.8rem;
                color: #666;
                text-align: center;
                margin-top: 1rem;
                line-height: 1.4;
            }
            
            /* Mobile responsive */
            @media (max-width: 768px) {
                .container {
                    padding: 1rem;
                    margin: 10px;
                }
                .header h1 {
                    font-size: 2rem;
                }
                .button-group {
                    flex-direction: column;
                    align-items: stretch;
                }
                .button-group .btn,
                .button-group .logout-btn {
                    width: 100%;
                    margin: 5px 0;
                }
                .upload-area {
                    padding: 2rem 1rem;
                }
                .upload-icon {
                    font-size: 3rem;
                }
                .upload-text {
                    font-size: 1.1rem;
                }
            }
            
            @media (max-width: 480px) {
                .header h1 {
                    font-size: 1.8rem;
                }
                .btn, .logout-btn {
                    padding: 12px 20px;
                    font-size: 14px;
                }
                .file-item {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 10px;
                }
                .file-info {
                    width: 100%;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📤 FileDrop Upload</h1>
                <p>Secure File Upload System v2.1</p>
                ${AUTH_CONFIG.enabled ? `<p>Welcome, <strong>${req.session.username}</strong>!</p>` : ''}
            </div>
            
            <div class="status-bar">
                <span>✅ Server is running and ready to receive files</span>
                <span id="serverStatus">🟢 Online</span>
            </div>
            
            <div class="upload-area" id="uploadArea">
                <div class="upload-icon">📁</div>
                <div class="upload-text">Drag & Drop files here</div>
                <div class="upload-subtext">or click to browse files (Max: 20 files, 500MB each)</div>
                
                <!-- Mobile photo warning -->
                <div class="mobile-warning" id="mobileWarning" style="display: none;">
                    📱 <strong>Mobile Users Notice:</strong><br>
                    Photos from mobile browsers may be compressed automatically.<br>
                    For original quality, use file manager apps or desktop browsers.
                </div>
                
                <input type="file" id="fileInput" class="file-input" multiple>
                
                <div class="button-group">
                    <button type="button" class="btn" onclick="document.getElementById('fileInput').click()">
                        📎 Choose Files
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="uploadFiles()" id="uploadBtn">
                        🚀 Upload Files
                    </button>
                    <button type="button" class="btn btn-danger" onclick="clearFiles()" id="clearBtn" style="display: none;">
                        🗑️ Clear All
                    </button>
                    ${AUTH_CONFIG.enabled ? `
                    <form method="POST" action="/api/logout" style="display: inline; order: 999;">
                        <button type="submit" class="logout-btn">👋 Sign Out</button>
                    </form>
                    ` : ''}
                </div>
                
                <div class="progress-container" id="progressContainer">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill">0%</div>
                    </div>
                    <div id="progressText" style="text-align: center; margin-top: 10px; font-weight: bold;"></div>
                </div>
                
                <div class="limits-info">
                    💡 Limits: Maximum 20 files, 500MB per file, 10 minute timeout<br>
                    📸 Mobile photos: May be auto-compressed by browser - use file manager apps for originals
                </div>
            </div>
            
            <div class="file-list" id="fileList"></div>
        </div>

        <script>
            let selectedFiles = [];
            const uploadArea = document.getElementById('uploadArea');
            const fileInput = document.getElementById('fileInput');
            const fileList = document.getElementById('fileList');
            const progressContainer = document.getElementById('progressContainer');
            const progressFill = document.getElementById('progressFill');
            const progressText = document.getElementById('progressText');
            const uploadBtn = document.getElementById('uploadBtn');
            const clearBtn = document.getElementById('clearBtn');

            // Check server status
            async function checkServerStatus() {
                try {
                    const response = await fetch('/api/health');
                    const status = document.getElementById('serverStatus');
                    if (response.ok) {
                        status.innerHTML = '🟢 Online';
                        status.style.color = '#28a745';
                    } else {
                        status.innerHTML = '🟡 Issues';
                        status.style.color = '#ffc107';
                    }
                } catch (error) {
                    const status = document.getElementById('serverStatus');
                    status.innerHTML = '🔴 Offline';
                    status.style.color = '#dc3545';
                }
            }

            // Check if mobile device and show warning
            function checkMobileAndShowWarning() {
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                
                if (isMobile || isIOS) {
                    const warning = document.getElementById('mobileWarning');
                    if (warning) {
                        warning.style.display = 'block';
                    }
                }
            }

            // Check status every 30 seconds
            setInterval(checkServerStatus, 30000);
            checkServerStatus();
            
            // Check for mobile on page load
            checkMobileAndShowWarning();

            // Drag and drop events
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('drag-over');
            });

            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                if (!uploadArea.contains(e.relatedTarget)) {
                    uploadArea.classList.remove('drag-over');
                }
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
                
                const files = Array.from(e.dataTransfer.files);
                addFiles(files);
            });

            // File input change
            fileInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                addFiles(files);
            });

            function addFiles(files) {
                const totalFiles = selectedFiles.length + files.length;
                if (totalFiles > 20) {
                    showMessage('⚠️ Maximum 20 files allowed. Currently trying to add ' + totalFiles + ' files.', 'warning');
                    return;
                }
                
                // Check file sizes
                const oversizedFiles = files.filter(file => file.size > 500 * 1024 * 1024);
                if (oversizedFiles.length > 0) {
                    showMessage('⚠️ Some files are larger than 500MB: ' + oversizedFiles.map(f => f.name).join(', '), 'warning');
                    return;
                }
                
                // Check for image files on mobile and warn
                const imageFiles = files.filter(file => file.type.startsWith('image/'));
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                
                if (isMobile && imageFiles.length > 0) {
                    showMessage('📱 Mobile detected: Photos may be compressed by browser. For original quality, use file manager apps.', 'warning');
                }
                
                selectedFiles = [...selectedFiles, ...files];
                displayFiles();
            }

            function displayFiles() {
                fileList.innerHTML = '';
    
                if (selectedFiles.length > 0) {
                    const header = document.createElement('div');
                    header.className = 'file-counter';
                    header.innerHTML = \`📋 Files selected: \${selectedFiles.length}/20\`;
                    fileList.appendChild(header);
                    
                    clearBtn.style.display = 'inline-block';
                } else {
                    clearBtn.style.display = 'none';
                }

                selectedFiles.forEach((file, index) => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    fileItem.innerHTML = \`
                        <div class="file-info">
                            <div class="file-name">📄 \${file.name}</div>
                            <div class="file-size">\${formatFileSize(file.size)}</div>
                        </div>
                        <button onclick="removeFile(\${index})" class="btn btn-danger" style="padding: 5px 10px; margin: 0;">❌</button>
                    \`;
                    fileList.appendChild(fileItem);
                });
            }

            function removeFile(index) {
                selectedFiles.splice(index, 1);
                displayFiles();
            }
            
            function clearFiles() {
                selectedFiles = [];
                fileInput.value = '';
                displayFiles();
                showMessage('🗑️ All files cleared', 'success');
            }

            function formatFileSize(bytes) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
            }

            function showMessage(message, type) {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'status-' + type;
                messageDiv.innerHTML = message;
                
                // Replace existing messages
                const existingMessages = fileList.querySelectorAll('.status-success, .status-error, .status-warning');
                existingMessages.forEach(msg => msg.remove());
                
                fileList.appendChild(messageDiv);
                
                // Auto-remove success messages after 5 seconds
                if (type === 'success') {
                    setTimeout(() => {
                        if (messageDiv.parentNode) {
                            messageDiv.remove();
                        }
                    }, 5000);
                }
            }

            async function uploadFiles() {
                if (selectedFiles.length === 0) {
                    showMessage('❌ Please select files to upload', 'error');
                    return;
                }

                uploadBtn.disabled = true;
                uploadBtn.innerHTML = '⏳ Uploading...';
                progressContainer.style.display = 'block';
                
                const formData = new FormData();
                selectedFiles.forEach(file => {
                    formData.append('files', file);
                });

                try {
                    const xhr = new XMLHttpRequest();
                    
                    // Upload progress
                    xhr.upload.addEventListener('progress', (e) => {
                        if (e.lengthComputable) {
                            const percentComplete = Math.round((e.loaded / e.total) * 100);
                            progressFill.style.width = percentComplete + '%';
                            progressFill.textContent = percentComplete + '%';
                            progressText.textContent = \`Uploading... \${percentComplete}% (\${formatFileSize(e.loaded)} / \${formatFileSize(e.total)})\`;
                        }
                    });
                    
                    xhr.onload = function() {
                        if (xhr.status === 401) {
                            showMessage('🔒 Session expired. Please login again.', 'error');
                            setTimeout(() => window.location.href = '/login', 2000);
                            return;
                        }
                        
                        try {
                            const result = JSON.parse(xhr.responseText);
                            
                            if (xhr.status === 200 && result.success) {
                                progressFill.style.width = '100%';
                                progressFill.textContent = '✅ Complete';
                                progressText.textContent = \`Successfully uploaded \${result.count} files\`;
                                
                                showMessage(\`✅ Successfully uploaded \${result.count} file(s)!\`, 'success');
                                
                                selectedFiles = [];
                                fileInput.value = '';
                                displayFiles();
                                
                                setTimeout(() => {
                                    progressContainer.style.display = 'none';
                                    progressFill.style.width = '0%';
                                    progressFill.textContent = '0%';
                                    progressText.textContent = '';
                                }, 3000);
                            } else {
                                throw new Error(result.error || 'Upload failed');
                            }
                        } catch (parseError) {
                            throw new Error('Server response error');
                        }
                    };
                    
                    xhr.onerror = function() {
                        throw new Error('Network error occurred');
                    };
                    
                    xhr.ontimeout = function() {
                        throw new Error('Upload timed out - try smaller files or fewer files at once');
                    };
                    
                    xhr.timeout = 10 * 60 * 1000; // 10 minute timeout
                    
                    xhr.open('POST', '/api/upload');
                    xhr.send(formData);
                    
                } catch (error) {
                    console.error('Upload error:', error);
                    showMessage(\`❌ Upload failed: \${error.message}\`, 'error');
                    progressContainer.style.display = 'none';
                } finally {
                    uploadBtn.disabled = false;
                    uploadBtn.innerHTML = '🚀 Upload Files';
                }
            }
        </script>
    </body>
    </html>
  `);
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/upload');
});

// Initialize and start server
async function startServer() {
  try {
    await redisClient.connect();
    await setupFileWatcher();
    
    if (CLEANUP_CONFIG.autoCleanupInterval > 0) {
      setInterval(cleanupOldFiles, CLEANUP_CONFIG.autoCleanupInterval * 60 * 60 * 1000);
      logWithTime(`⏰ Auto cleanup scheduled every ${CLEANUP_CONFIG.autoCleanupInterval} hours`, 'info');
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(chalk.green('\n🚀 FileDrop Server Started!'));
      console.log(chalk.cyan('==============================='));
      console.log(chalk.white(`📡 Local:     http://localhost:${PORT}`));
      console.log(chalk.white(`📡 Network:   http://YOUR_SERVER_IP:${PORT}`));
      console.log(chalk.white(`📁 Uploads:   ${path.resolve(UPLOAD_PATH)}`));
      console.log(chalk.white(`👀 Watching:  ${path.resolve(UPLOAD_PATH)}`));
      console.log(chalk.white(`🔗 API:       http://localhost:${PORT}/api/status`));
      console.log(chalk.cyan('==============================='));
      console.log(chalk.white(`🔐 Authentication: ${AUTH_CONFIG.enabled ? 'Enabled' : 'Disabled'}`));
      if (AUTH_CONFIG.enabled) {
        console.log(chalk.white(`👤 Username: ${AUTH_CONFIG.username}`));
        console.log(chalk.white(`🔑 Password: [HIDDEN]`));
        console.log(chalk.white(`🔐 API Key: ${AUTH_CONFIG.apiKey}`));
        console.log(chalk.white(`🌐 Login URL: http://localhost:${PORT}/login`));
      }
      console.log(chalk.white(`📤 Upload URL: http://localhost:${PORT}/upload`));
      console.log(chalk.cyan('==============================='));
      console.log(chalk.white(`📝 Upload Improvements:`));
      console.log(chalk.white(`   - Fixed "Unexpected end of form" errors`));
      console.log(chalk.white(`   - Better error handling and user feedback`));
      console.log(chalk.white(`   - Improved upload progress tracking`));
      console.log(chalk.white(`   - Enhanced file validation`));
      console.log(chalk.white(`   - 10-minute upload timeout for large files`));
      console.log(chalk.cyan('==============================='));
      console.log(chalk.white(`🗑️  Cleanup Settings:`));
      console.log(chalk.white(`   Delete after download: ${CLEANUP_CONFIG.deleteAfterDownload ? 'Yes' : 'No'}`));
      console.log(chalk.white(`   Keep files for: ${CLEANUP_CONFIG.keepFilesForDays} days`));
      console.log(chalk.white(`   Auto cleanup: ${CLEANUP_CONFIG.autoCleanupInterval}h intervals`));
      console.log(chalk.cyan('==============================='));
      console.log(chalk.yellow('💡 Ready for uploads and file monitoring!'));
      console.log(chalk.gray('\nPress Ctrl+C to stop\n'));
    });
  } catch (error) {
    console.error(chalk.red('❌ Failed to start:'), error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n🛑 Shutting down FileDrop server...'));
  try {
    await redisClient.quit();
    console.log(chalk.green('✅ Server stopped successfully'));
  } catch (error) {
    console.log(chalk.red('❌ Error during shutdown'));
  }
  process.exit(0);
});

// Start server
startServer();