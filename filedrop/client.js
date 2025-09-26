const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { machineId } = require('node-machine-id');
const os = require('os');

// ASCII Art Banner
console.log(chalk.blue(`
 ███████╗██╗██╗     ███████╗██████╗ ██████╗  ██████╗ ██████╗ 
 ██╔════╝██║██║     ██╔════╝██╔══██╗██╔══██╗██╔═══██╗██╔══██╗
 █████╗  ██║██║     █████╗  ██║  ██║██████╔╝██║   ██║██████╔╝
 ██╔══╝  ██║██║     ██╔══╝  ██║  ██║██╔══██╗██║   ██║██╔═══╝ 
 ██║     ██║███████╗███████╗██████╔╝██║  ██║╚██████╔╝██║     
 ╚═╝     ╚═╝╚══════╝╚══════╝╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝     
                                                              
        💻 Multi-Server File Synchronization Client v2.0     
`));

class ServerConnection {
  constructor(serverConfig, clientId, globalDownloadPath) {
    this.name = serverConfig.name || 'Unnamed Server';
    this.url = serverConfig.url;
    this.downloadPath = serverConfig.downloadPath; 
    this.pollInterval = serverConfig.pollInterval || 30000;
    this.maxRetries = serverConfig.maxRetries || 3;
    this.priority = serverConfig.priority || 1;
    this.enabled = serverConfig.enabled !== false;
    this.apiKey = serverConfig.apiKey || null; // API key สำหรับ authentication
    this.clientId = clientId;
    this.isRunning = false;
    this.stats = {
      totalDownloaded: 0,
      filesDownloaded: 0,
      errors: 0,
      lastSync: null,
      consecutiveErrors: 0
    };

    // เก็บ global path สำหรับใช้งาน
    ServerConnection.globalDownloadPath = globalDownloadPath;

    // Create unique download path for this server
    this.initializeDownloadPath();
  }

  async initializeDownloadPath() {
    try {
      await this.ensureDownloadPath();
    } catch (error) {
      console.error(chalk.red(`❌ Failed to initialize ${this.name}: ${error.message}`));
      this.enabled = false; // ปิดการใช้งาน server นี้ชั่วคราว
    }
  }

  async ensureDownloadPath() {
    try {
      let serverPath;
      
      // ใช้ downloadPath เฉพาะของ server หรือ default path
      if (this.downloadPath && this.downloadPath !== this.constructor.globalDownloadPath) {
        // ใช้ path เฉพาะของ server
        serverPath = this.downloadPath;
      } else {
        // ใช้ global path + server subfolder
        const globalPath = this.constructor.globalDownloadPath || './downloads';
        serverPath = path.join(globalPath, this.sanitizeServerName(this.name));
      }
      
      console.log(chalk.gray(`   └─ Creating path: ${path.resolve(serverPath)}`));
      await fs.ensureDir(serverPath);
      this.serverDownloadPath = serverPath;
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to create download path for ${this.name}:`));
      console.error(chalk.red(`   Error: ${error.message}`));
      console.error(chalk.red(`   Path: ${this.downloadPath || 'undefined'}`));
      throw error; 
    }
  }

  sanitizeServerName(name) {
    return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, '_');
  }

  // สร้าง headers สำหรับการ authenticate
  getHeaders() {
    const headers = {};
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    return headers;
  }

  async checkServerHealth() {
    try {
      const response = await axios.get(`${this.url}/api/health`, {
        timeout: 5000,
        headers: this.getHeaders()
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async pollForFiles() {
    if (!this.enabled) return;

    try {
      const response = await axios.get(`${this.url}/api/jobs/pending`, {
        params: { clientId: this.clientId, limit: 5 },
        timeout: 10000,
        headers: this.getHeaders()
      });

      const { jobs, count } = response.data;

      if (count === 0) {
        this.logWithTime('💤 No pending files', 'info');
        this.stats.consecutiveErrors = 0;
        return { success: true, jobsFound: 0 };
      }

      this.logWithTime(`📋 Found ${count} pending file(s)`, 'success');

      let processedJobs = 0;
      for (const job of jobs) {
        try {
          await this.processJob(job);
          processedJobs++;
        } catch (error) {
          this.logWithTime(`❌ Failed to process job ${job.id}: ${error.message}`, 'error');
        }
      }

      this.stats.lastSync = new Date();
      this.stats.consecutiveErrors = 0;
      return { success: true, jobsFound: count, jobsProcessed: processedJobs };

    } catch (error) {
      this.stats.consecutiveErrors++;
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        this.logWithTime('🔌 Server not reachable', 'warning');
      } else if (error.code === 'ECONNABORTED') {
        this.logWithTime('⏱️ Request timeout', 'warning');
      } else {
        this.logWithTime(`❌ Poll error: ${error.message}`, 'error');
      }
      
      return { success: false, error: error.message };
    }
  }

  async processJob(job) {
    let retryCount = 0;
    
    while (retryCount < this.maxRetries) {
      try {
        const success = await this.downloadFile(job);
        
        if (success) {
          await this.markJobCompleted(job.id);
          this.stats.filesDownloaded++;
          return;
        }
        
      } catch (error) {
        retryCount++;
        this.logWithTime(
          `🔄 Retry ${retryCount}/${this.maxRetries} for ${job.originalName}: ${error.message}`,
          'warning'
        );
        
        if (retryCount < this.maxRetries) {
          await this.sleep(2000 * retryCount);
        }
      }
    }
    
    this.logWithTime(`💥 Failed to download ${job.originalName} after ${this.maxRetries} attempts`, 'error');
    this.stats.errors++;
  }

  async downloadFile(job) {
    try {
      this.logWithTime(
        `📥 [${this.name}] Downloading: ${job.originalName} (${this.formatFileSize(job.size)})`,
        'info'
      );

      const response = await axios({
        method: 'GET',
        url: `${this.url}/api/download/${job.id}`,
        params: { clientId: this.clientId },
        responseType: 'stream',
        timeout: 300000,
        headers: this.getHeaders(),
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentComplete = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            process.stdout.write(`\r📊 [${this.name}] Progress: ${percentComplete}% (${this.formatFileSize(progressEvent.loaded)}/${this.formatFileSize(progressEvent.total)})`);
          }
        }
      });

      // ใช้ชื่อเดิมเลย ไม่แก้อะไร
      const fileName = job.originalName;
      const filePath = this.getUniqueFilePath(path.join(this.serverDownloadPath, fileName));
      
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', async () => {
          process.stdout.write('\r' + ' '.repeat(100) + '\r');
          
          try {
            const stats = await fs.stat(filePath);
            if (stats.size !== job.size) {
              await fs.unlink(filePath);
              throw new Error(`File size mismatch: expected ${job.size}, got ${stats.size}`);
            }

            this.logWithTime(`✅ [${this.name}] Downloaded: ${path.basename(filePath)}`, 'success');
            this.stats.totalDownloaded += job.size;
            resolve(true);
            
          } catch (error) {
            reject(error);
          }
        });

        writer.on('error', (error) => {
          process.stdout.write('\r' + ' '.repeat(100) + '\r');
          reject(error);
        });

        response.data.on('error', (error) => {
          process.stdout.write('\r' + ' '.repeat(100) + '\r');
          reject(error);
        });
      });

    } catch (error) {
      process.stdout.write('\r' + ' '.repeat(100) + '\r');
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('Download timeout');
      }
      throw error;
    }
  }

  async markJobCompleted(jobId) {
    try {
      await axios.post(`${this.url}/api/jobs/${jobId}/complete`, {
        clientId: this.clientId
      }, { 
        timeout: 5000,
        headers: this.getHeaders()
      });
      
    } catch (error) {
      this.logWithTime(`⚠️ Failed to mark job as completed: ${error.message}`, 'warning');
    }
  }

  getUniqueFilePath(filePath) {
    if (!fs.existsSync(filePath)) {
      return filePath;
    }

    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const name = path.basename(filePath, ext);

    let counter = 1;
    let newPath;
    
    do {
      newPath = path.join(dir, `${name} (${counter})${ext}`);
      counter++;
    } while (fs.existsSync(newPath));

    this.logWithTime(`📝 [${this.name}] File renamed to avoid duplicate: ${path.basename(newPath)}`, 'info');
    return newPath;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  logWithTime(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red
    };
    
    console.log(`[${chalk.gray(timestamp)}] ${colors[level](message)}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class MultiServerFileDropClient {
  constructor(config) {
    this.downloadPath = config.downloadPath;
    this.servers = [];
    this.clientId = null;
    this.isRunning = false;
    this.globalStats = {
      totalServers: 0,
      activeServers: 0,
      totalDownloaded: 0,
      totalFiles: 0,
      totalErrors: 0
    };

    this.initializeClient(config);
  }

  async initializeClient(config) {
    try {
      // Generate unique client ID
      this.clientId = await machineId();
      this.clientId = `${os.hostname()}-${this.clientId.substring(0, 8)}`;
      
      // Ensure main download directory exists
      await fs.ensureDir(this.downloadPath);
      
      // Initialize server connections
      if (config.servers && Array.isArray(config.servers)) {
        console.log(chalk.blue('🔧 Initializing server connections...'));
        
        for (const serverConfig of config.servers) {
          try {
            const server = new ServerConnection(serverConfig, this.clientId, this.downloadPath);
            await server.initializeDownloadPath(); // รอให้สร้าง path เสร็จ
            this.servers.push(server);
            
            const statusIcon = server.enabled ? chalk.green('✓') : chalk.red('❌');
            console.log(`${statusIcon} ${server.name} initialized`);
            
          } catch (error) {
            console.error(chalk.red(`❌ Failed to initialize ${serverConfig.name || 'unnamed server'}:`));
            console.error(chalk.red(`   ${error.message}`));
          }
        }
      }

      this.globalStats.totalServers = this.servers.length;
      this.globalStats.activeServers = this.servers.filter(s => s.enabled).length;

      console.log(chalk.green('🚀 Multi-Server FileDrop Client Initialized'));
      console.log(chalk.cyan('==========================================='));
      console.log(chalk.white(`🆔 Client ID:      ${this.clientId}`));
      console.log(chalk.white(`📁 Downloads:      ${path.resolve(this.downloadPath)}`));
      console.log(chalk.white(`🖥️  Total Servers:   ${this.globalStats.totalServers}`));
      console.log(chalk.white(`✅ Active Servers:  ${this.globalStats.activeServers}`));
      console.log(chalk.cyan('==========================================='));
      
      // Display server details
      console.log(chalk.blue('\n📋 Server Configuration:'));
      for (const server of this.servers) {
        const status = server.enabled ? chalk.green('✓') : chalk.red('✗');
        const priority = `P${server.priority}`;
        console.log(chalk.white(`${status} [${priority}] ${server.name}: ${server.url}`));
        
        if (server.serverDownloadPath) {
          console.log(chalk.gray(`    └─ Downloads: ${path.resolve(server.serverDownloadPath)}`));
        } else if (!server.enabled) {
          console.log(chalk.red(`    └─ Server disabled due to initialization error`));
        }
      }
      console.log(chalk.cyan('==========================================='));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize client:'), error.message);
      process.exit(1);
    }
  }

  async start() {
    if (this.isRunning) {
      console.log(chalk.yellow('⚠️ Client is already running'));
      return;
    }

    this.isRunning = true;
    console.log(chalk.green('\n✅ Multi-Server FileDrop Client started\n'));
    
    // Check server health before starting
    await this.checkAllServersHealth();
    
    // Start polling loop
    this.pollAllServers();
  }

  stop() {
    this.isRunning = false;
    console.log(chalk.yellow('\n🛑 Multi-Server FileDrop Client stopped\n'));
  }

  async checkAllServersHealth() {
    console.log(chalk.blue('🏥 Checking server health...'));
    
    for (const server of this.servers) {
      if (!server.enabled) continue;
      
      const isHealthy = await server.checkServerHealth();
      const status = isHealthy ? chalk.green('✓ Online') : chalk.red('✗ Offline');
      console.log(`   ${status} ${server.name} (${server.url})`);
    }
    console.log('');
  }

  async pollAllServers() {
    while (this.isRunning) {
      try {
        // Sort servers by priority (higher priority first)
        const sortedServers = this.servers
          .filter(server => server.enabled)
          .sort((a, b) => b.priority - a.priority);

        let totalJobsFound = 0;
        let activeServerCount = 0;

        // Poll each server
        for (const server of sortedServers) {
          if (!this.isRunning) break;
          
          try {
            const result = await server.pollForFiles();
            if (result.success) {
              activeServerCount++;
              totalJobsFound += result.jobsFound || 0;
            }
            
            // Add small delay between servers to avoid overwhelming
            if (sortedServers.indexOf(server) < sortedServers.length - 1) {
              await this.sleep(1000);
            }
            
          } catch (error) {
            server.logWithTime(`❌ Server polling error: ${error.message}`, 'error');
          }
        }

        this.updateGlobalStats();

        // If no jobs found across all servers, wait longer
        const waitTime = totalJobsFound > 0 ? 5000 : this.getMinPollInterval();
        await this.sleep(waitTime);

      } catch (error) {
        console.error(chalk.red('❌ Global polling error:'), error.message);
        await this.sleep(30000); // Wait 30 seconds on global error
      }
    }
  }

  getMinPollInterval() {
    const enabledServers = this.servers.filter(s => s.enabled);
    if (enabledServers.length === 0) return 30000;
    
    return Math.min(...enabledServers.map(s => s.pollInterval));
  }

  updateGlobalStats() {
    this.globalStats.totalDownloaded = this.servers.reduce((sum, s) => sum + s.stats.totalDownloaded, 0);
    this.globalStats.totalFiles = this.servers.reduce((sum, s) => sum + s.stats.filesDownloaded, 0);
    this.globalStats.totalErrors = this.servers.reduce((sum, s) => sum + s.stats.errors, 0);
  }

  printStats() {
    this.updateGlobalStats();
    
    console.log(chalk.cyan('\n📊 Global Session Statistics:'));
    console.log(chalk.cyan('================================'));
    console.log(chalk.white(`Total Files Downloaded: ${this.globalStats.totalFiles}`));
    console.log(chalk.white(`Total Data Downloaded:  ${this.formatFileSize(this.globalStats.totalDownloaded)}`));
    console.log(chalk.white(`Total Errors:           ${this.globalStats.totalErrors}`));
    console.log(chalk.white(`Active Servers:         ${this.globalStats.activeServers}/${this.globalStats.totalServers}`));

    console.log(chalk.cyan('\n📈 Per-Server Statistics:'));
    console.log(chalk.cyan('==========================='));
    
    for (const server of this.servers) {
      const statusIcon = server.enabled ? '✅' : '❌';
      const errorRate = server.stats.filesDownloaded > 0 
        ? Math.round((server.stats.errors / (server.stats.filesDownloaded + server.stats.errors)) * 100)
        : 0;
        
      console.log(chalk.white(`${statusIcon} ${server.name}:`));
      console.log(chalk.gray(`    Files: ${server.stats.filesDownloaded} | Data: ${this.formatFileSize(server.stats.totalDownloaded)} | Errors: ${server.stats.errors} (${errorRate}%)`));
      console.log(chalk.gray(`    Last Sync: ${server.stats.lastSync ? server.stats.lastSync.toLocaleString() : 'Never'}`));
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Configuration management
async function loadConfig() {
  const configPath = path.join(__dirname, 'config.json');
  
  try {
    const configData = await fs.readJson(configPath);
    
    // รองรับ config แบบใหม่ที่มี client object
    let clientConfig;
    if (configData.client) {
      // Config แบบใหม่ที่มี server, client, cleanup
      clientConfig = configData.client;
    } else {
      // Config แบบเก่าที่เป็น flat structure
      clientConfig = configData;
    }
    
    // Validate required fields
    if (!clientConfig.servers || !Array.isArray(clientConfig.servers) || clientConfig.servers.length === 0) {
      throw new Error('servers array is required in config.json under client section');
    }
    
    // Validate each server config
    for (const server of clientConfig.servers) {
      if (!server.url) {
        throw new Error(`Server URL is required for server: ${server.name || 'unnamed'}`);
      }
    }
    
    return {
      downloadPath: clientConfig.downloadPath || './downloads',
      servers: clientConfig.servers
    };
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(chalk.yellow('⚠️ Config file not found. Creating default config.json...'));
      
      const defaultConfig = {
        server: {
          port: 3000,
          uploadPath: "./uploads"
        },
        client: {
          downloadPath: "./downloads",
          servers: [
            {
              name: "Primary Server",
              url: "http://localhost:3000",
              downloadPath: null,
              pollInterval: 30000,
              maxRetries: 3,
              priority: 1,
              enabled: true
            }
          ]
        },
        cleanup: {
          deleteAfterDownload: true,
          keepFilesForDays: 3,
          autoCleanupInterval: 24
        }
      };
      
      await fs.writeJson(configPath, defaultConfig, { spaces: 2 });
      
      console.log(chalk.green('✅ Default config created at:'), configPath);
      console.log(chalk.white('Please edit the configuration and restart the client.'));
      process.exit(0);
    }
    
    throw error;
  }
}

// Main execution
async function main() {
  try {
    const config = await loadConfig();
    const client = new MultiServerFileDropClient(config);

    // Graceful shutdown handlers
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n🛑 Shutting down Multi-Server FileDrop client...'));
      client.stop();
      client.printStats();
      console.log(chalk.green('🎉 Multi-Server FileDrop client stopped successfully'));
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      client.stop();
      process.exit(0);
    });

    // Unhandled error handler
    process.on('uncaughtException', (error) => {
      console.error(chalk.red('💥 Uncaught Exception:'), error);
      client.stop();
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error(chalk.red('💥 Unhandled Rejection at:'), promise, 'reason:', reason);
    });

    // Start the client
    await client.start();

  } catch (error) {
    console.error(chalk.red('❌ Failed to start client:'), error.message);
    console.log(chalk.yellow('\n💡 Troubleshooting:'));
    console.log(chalk.white('1. Check if the servers are running'));
    console.log(chalk.white('2. Verify server URLs in config.json'));
    console.log(chalk.white('3. Ensure network connectivity'));
    console.log(chalk.white('4. Check server configuration format'));
    process.exit(1);
  }
}

// Display startup message
console.log(chalk.gray('Starting Multi-Server FileDrop client...'));
main();