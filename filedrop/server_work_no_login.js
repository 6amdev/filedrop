const express = require('express');
const multer = require('multer');
const redis = require('redis');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const chalk = require('chalk');
const chokidar = require('chokidar');

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

// ASCII Banner
console.log(chalk.cyan(`
 ███████╗██╗██╗     ███████╗██████╗ ██████╗  ██████╗ ██████╗ 
 ██╔════╝██║██║     ██╔════╝██╔══██╗██╔══██╗██╔═══██╗██╔══██╗
 █████╗  ██║██║     █████╗  ██║  ██║██████╔╝██║   ██║██████╔╝
 ██╔══╝  ██║██║     ██╔══╝  ██║  ██║██╔══██╗██║   ██║██╔═══╝ 
 ██║     ██║███████╗███████╗██████╔╝██║  ██║╚██████╔╝██║     
 ╚═╝     ╚═╝╚══════╝╚══════╝╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝     
                                                              
            🚀 FileDrop Server v2.0 - Original Filenames     
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
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use(express.static('./'));

// Create upload directory
if (!fs.existsSync(UPLOAD_PATH)) {
  fs.mkdirSync(UPLOAD_PATH, { recursive: true });
}

// Multer setup - เก็บชื่อเดิมเลย ไม่แก้อะไร
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_PATH);
  },
  filename: (req, file, cb) => {
    // เก็บชื่อเดิมเลย แต่เพิ่ม timestamp ด้านหน้าเพื่อป้องกันชื่อซ้ำ
    const timestamp = Date.now();
    const fileName = `${timestamp}___${file.originalname}`;  // ใช้ ___ เป็นตัวแยก
    cb(null, fileName);
  }
});

const upload = multer({ 
  storage,
  limits: { 
    fileSize: 500 * 1024 * 1024,
    files: 5
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

// ฟังก์ชั่นสำหรับแยก timestamp กับชื่อไฟล์
function extractOriginalFilename(storedFilename) {
  // ตรวจสอบว่ามี ___ หรือไม่
  const parts = storedFilename.split('___');
  if (parts.length >= 2) {
    // เอาทุกส่วนหลัง ___ มาต่อกัน (ในกรณีที่ชื่อไฟล์เดิมมี ___ ด้วย)
    return parts.slice(1).join('___');
  }
  
  // ถ้าไม่มี ___ (ไฟล์เก่า) ให้ส่งกลับเดิม
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
        
        // ถ้าไฟล์มี ___ แปลว่าเป็นไฟล์ที่ถูก upload ผ่าน API แล้ว ไม่ต้องทำอะไร
        if (fileName.includes('___')) {
          return;
        }
        
        const stats = fs.statSync(filePath);
        
        // สำหรับไฟล์ที่ถูกวางใน folder โดยตรง
        const timestamp = Date.now();
        const newFileName = `${timestamp}___${fileName}`;  // เก็บชื่อเดิม
        const newFilePath = path.join(UPLOAD_PATH, newFileName);
        
        // Rename file
        fs.renameSync(filePath, newFilePath);
        
        const job = {
          id: uuidv4(),
          originalName: fileName,        // ชื่อเดิม
          fileName: newFileName,         // ชื่อที่เก็บจริงใน disk
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

// API Routes

// 1. Upload file
app.post('/api/upload', upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const jobs = [];
    
    for (const file of req.files) {
      const originalName = extractOriginalFilename(file.filename);
      
      const job = {
        id: uuidv4(),
        originalName: originalName,      // ชื่อต้นฉบับ
        fileName: file.filename,         // ชื่อที่เก็บใน disk (มี timestamp)
        size: file.size,
        uploadedAt: new Date().toISOString(),
        status: 'pending'
      };

      await redisClient.lPush('filedrop_queue', JSON.stringify(job));
      jobs.push(job);
      
      logWithTime(`📤 File uploaded: ${originalName} (${formatFileSize(job.size)})`, 'success');
    }
    
    res.json({
      message: `${jobs.length} file(s) uploaded successfully`,
      jobs: jobs.map(job => ({
        id: job.id,
        fileName: job.originalName,      // ส่งชื่อต้นฉบับ
        size: formatFileSize(job.size)
      }))
    });

  } catch (error) {
    logWithTime(`Upload error: ${error.message}`, 'error');
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large (max 500MB per file)' 
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        error: 'Too many files (max 5 files)' 
      });
    }
    
    res.status(500).json({ error: 'Upload failed' });
  }
});

// 2. Get pending jobs
app.get('/api/jobs/pending', async (req, res) => {
  try {
    const jobs = [];
    const queueLength = await redisClient.lLen('filedrop_queue');
    
    for (let i = 0; i < Math.min(queueLength, 10); i++) {
      const jobData = await redisClient.lIndex('filedrop_queue', i);
      if (jobData) {
        jobs.push(JSON.parse(jobData));
      }
    }

    res.json({ jobs, count: jobs.length });

  } catch (error) {
    logWithTime(`Get jobs error: ${error.message}`, 'error');
    res.status(500).json({ error: 'Failed to get jobs' });
  }
});

// 3. Download file with original filename
app.get('/api/download/:jobId', async (req, res) => {
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
      return res.status(404).json({ error: 'Job not found' });
    }

    const filePath = path.join(UPLOAD_PATH, targetJob.fileName);
    
    if (!fs.existsSync(filePath)) {
      await redisClient.lRem('filedrop_queue', 1, JSON.stringify(targetJob));
      logWithTime(`🗑️  Removed stale job: ${targetJob.originalName}`, 'warning');
      return res.status(404).json({ error: 'File no longer exists' });
    }

    logWithTime(`📥 File downloaded: ${targetJob.originalName}`, 'info');
    
    // ส่งไฟล์พร้อมชื่อต้นฉบับ
    res.download(filePath, targetJob.originalName);

  } catch (error) {
    logWithTime(`Download error: ${error.message}`, 'error');
    res.status(500).json({ error: 'Download failed' });
  }
});

// 4. Complete job
app.post('/api/jobs/:jobId/complete', async (req, res) => {
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
          
          return res.json({ message: 'Job completed' });
        }
      }
    }

    res.status(404).json({ error: 'Job not found' });

  } catch (error) {
    logWithTime(`Complete job error: ${error.message}`, 'error');
    res.status(500).json({ error: 'Failed to complete job' });
  }
});

// 5. Server status
app.get('/api/status', async (req, res) => {
  try {
    const pendingCount = await redisClient.lLen('filedrop_queue');
    const completedCount = await redisClient.lLen('filedrop_completed');
    
    res.json({
      status: 'running',
      version: '2.0.0',
      uptime: Math.floor(process.uptime()),
      pending: pendingCount,
      completed: completedCount,
      uploadPath: UPLOAD_PATH,
      fileWatcher: 'active',
      filenameHandling: 'original_names_with_duplicate_handling'
    });
  } catch (error) {
    res.status(500).json({ error: 'Status check failed' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
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
      console.log(chalk.white(`📝 Filename Handling: Original Names + Duplicate Handling`));
      console.log(chalk.white(`   - Files keep their original names exactly`));
      console.log(chalk.white(`   - Server adds timestamp prefix for storage only`));
      console.log(chalk.white(`   - Client handles duplicate names automatically`));
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