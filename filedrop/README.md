# 🚀 FileDrop Server v2.1 - Complete Installation Guide

FileDrop is a secure, modern file upload and management system built with Node.js, Express, and Redis. It supports real-time file monitoring, authentication, and provides both web interface and API access.

## 📸 Screenshots

### 🔐 Login Page
![FileDrop Login Page](screenshots/login-page.png)
*Secure login with modern glassmorphism design*

### 📤 Upload Interface  
![Upload Interface](screenshots/upload-interface.png)
*Drag & drop file upload with real-time progress*

### 📱 Mobile Responsive
![Mobile Interface](screenshots/mobile-interface.png)
*Fully responsive design works on all devices*

### 🖥️ Server Dashboard
![Server Running](screenshots/server-dashboard.png)
*Server status and monitoring in terminal*

### 📁 File Management
![File Browser](screenshots/file-browser.png)
*File listing and download interface*

## 📋 Table of Contents

- [Screenshots](#-screenshots)
- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Server Installation](#-server-installation)
  - [Ubuntu Server](#-ubuntu-server-installation)
  - [Windows Server](#-windows-server-installation)
- [Client Setup](#-client-setup)
  - [Ubuntu Client](#-ubuntu-client-setup)
  - [Windows Client](#-windows-client-setup)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Creating Screenshots](#-creating-screenshots)
- [Troubleshooting](#-troubleshooting)

## ✨ Features

- **🔐 Secure Authentication**: Username/password + API key support
- **📁 Original Filename Preservation**: Keeps original filenames with duplicate handling
- **📱 Responsive Design**: Works on desktop, tablet, and mobile
- **🔄 Real-time File Monitoring**: Auto-detects files dropped in upload folder
- **⚡ Progress Tracking**: Real-time upload progress with speed indicators
- **🗑️ Auto Cleanup**: Configurable file retention and cleanup
- **🌐 Cross-platform**: Linux, Windows, macOS support
- **📊 File Validation**: Size limits, type checking, mobile warnings
- **🔄 Drag & Drop**: Modern file selection interface

## 🛠 Prerequisites

### System Requirements
- **RAM**: Minimum 512MB, Recommended 2GB+
- **Storage**: 1GB+ free space (depends on file upload volume)
- **Network**: Internet connection for installation

### Required Software
- **Node.js**: v16.0+ (LTS recommended)
- **Redis**: v6.0+ 
- **npm**: v8.0+ (comes with Node.js)

---

# 📸 Creating Screenshots

To create screenshots for your FileDrop documentation, follow these steps:

## 🖼️ Required Screenshots

### 1. Login Page Screenshot
```bash
# Create screenshots directory
mkdir screenshots

# Take login page screenshot
# Method 1: Using browser developer tools
# 1. Open http://localhost:3000/login
# 2. Press F12 > Console
# 3. Paste this JavaScript:
```

```javascript
// Screenshot script for login page
setTimeout(() => {
    // Set viewport for consistent screenshots
    document.documentElement.style.width = '1200px';
    document.documentElement.style.height = '800px';
    
    // You can then use browser screenshot tools or:
    // Right-click > Inspect > Device Toolbar > Capture screenshot
}, 1000);
```

### 2. Upload Interface Screenshot
```bash
# Take upload interface screenshot
# 1. Navigate to http://localhost:3000/upload
# 2. Add some demo files to the upload area
# 3. Take screenshot showing:
#    - File selection area
#    - Selected files list
#    - Upload progress (if possible)
#    - Mobile warning (if on mobile)
```

### 3. Mobile Interface Screenshots
```bash
# Use browser dev tools for mobile simulation
# 1. Open Chrome/Firefox DevTools (F12)
# 2. Click device toolbar icon (phone/tablet icon)
# 3. Select device: iPhone 12 Pro or Galaxy S21
# 4. Navigate through login and upload pages
# 5. Take screenshots of mobile layouts
```

## 🛠️ Screenshot Tools

### Windows Tools
```powershell
# Using PowerShell with built-in screenshot
Add-Type -AssemblyName System.Windows.Forms,System.Drawing

$bounds = [System.Drawing.Rectangle]::FromLTRB(0, 0, 1200, 800)
$bmp = New-Object System.Drawing.Bitmap $bounds.width, $bounds.height
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.size)
$bmp.Save("screenshots\login-page.png")
$graphics.Dispose()
$bmp.Dispose()
```

**Recommended Windows Tools:**
- **Greenshot** (Free): https://getgreenshot.org/
- **Snagit** (Paid): https://www.techsmith.com/screen-capture.html
- **Windows Snipping Tool** (Built-in): `Win + Shift + S`

### Linux Tools
```bash
# Install screenshot tools
sudo apt install gnome-screenshot imagemagick -y

# Take full window screenshot
gnome-screenshot -w -f screenshots/upload-interface.png

# Take specific area screenshot
gnome-screenshot -a -f screenshots/login-page.png

# Using ImageMagick for automated screenshots
import -window root -crop 1200x800+100+100 screenshots/server-dashboard.png
```

**Recommended Linux Tools:**
- **GNOME Screenshot** (Built-in)
- **Flameshot**: `sudo apt install flameshot`
- **Shutter**: `sudo apt install shutter`

### Browser Extensions
**For consistent web screenshots:**
- **Full Page Screen Capture** (Chrome)
- **FireShot** (Firefox/Chrome)  
- **Awesome Screenshot** (Multi-browser)

## 📐 Screenshot Specifications

### Recommended Dimensions
```bash
# Desktop screenshots: 1200x800 or 1400x900
# Mobile screenshots: 375x667 (iPhone) or 414x896 (iPhone 11)
# Server terminal: 1000x600
```

### File Naming Convention
```
screenshots/
├── login-page.png              # Login interface
├── login-page-mobile.png       # Login on mobile
├── upload-interface.png        # Main upload page
├── upload-interface-mobile.png # Upload page mobile
├── upload-progress.png         # Upload in progress
├── file-browser.png           # File listing page
├── server-dashboard.png       # Terminal with server running
├── server-logs.png           # Server logs and status
└── api-response.png          # API testing example
```

## 🎨 Screenshot Guidelines

### Visual Standards
```bash
# 1. Consistent browser window size (1200px width recommended)
# 2. Clean browser interface (hide bookmarks bar)
# 3. Use demo data that looks realistic
# 4. Show different states (empty, with files, uploading)
# 5. Include error states if applicable
```

### Demo Content for Screenshots
```javascript
// Use these demo files for screenshots:
// - document.pdf (small PDF)
// - photo.jpg (medium image)
// - video.mp4 (large video file)
// - presentation.pptx (office document)
// - code.zip (archive file)

// Demo user credentials for consistent screenshots:
// Username: demo-user
// Files: 3-5 realistic files of different types and sizes
```

## 📱 Mobile Screenshot Process

### Using Chrome DevTools
```bash
# 1. Open Chrome DevTools (F12)
# 2. Click Toggle Device Toolbar (Ctrl+Shift+M)
# 3. Select device: iPhone 12 Pro (390x844)
# 4. Navigate to FileDrop pages
# 5. Use DevTools screenshot feature:
#    - Settings (⚙️) > Capture screenshot
#    - Or Ctrl+Shift+P > "screenshot"
```

### Mobile Screenshot Checklist
- [ ] Login page on mobile (portrait)
- [ ] Upload interface on mobile
- [ ] File selection on mobile  
- [ ] Upload progress on mobile
- [ ] Mobile navigation and buttons
- [ ] Responsive layout adaptation

## 🖥️ Server Screenshots

### Terminal Screenshots
```bash
# Ubuntu Server
# 1. Start server with: npm start
# 2. Show startup messages with ASCII art
# 3. Include server configuration output
# 4. Show file upload logs in action

# Windows Command Prompt  
# 1. Use modern terminal (Windows Terminal recommended)
# 2. Show server startup
# 3. Include Redis connection confirmation
# 4. Show real-time upload logs
```

### PM2 Dashboard Screenshot
```bash
# Show PM2 process management
pm2 list
pm2 monit  # Take screenshot of monitoring interface
```

## 🔧 Automated Screenshot Script

### Node.js Screenshot Automation
```javascript
// screenshot-generator.js
const puppeteer = require('puppeteer');
const path = require('path');

async function generateScreenshots() {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1200, height: 800 }
    });
    
    const page = await browser.newPage();
    
    // Login page screenshot
    await page.goto('http://localhost:3000/login');
    await page.waitForSelector('.login-container');
    await page.screenshot({ 
        path: 'screenshots/login-page.png',
        fullPage: true 
    });
    
    // Upload page screenshot (after login)
    await page.type('#username', 'admin');
    await page.type('#password', 'admin123');
    await page.click('.btn-login');
    await page.waitForNavigation();
    
    await page.screenshot({ 
        path: 'screenshots/upload-interface.png',
        fullPage: true 
    });
    
    // Mobile screenshots
    await page.setViewport({ width: 390, height: 844 });
    await page.goto('http://localhost:3000/login');
    await page.screenshot({ 
        path: 'screenshots/login-page-mobile.png',
        fullPage: true 
    });
    
    await browser.close();
}

generateScreenshots().catch(console.error);
```

### Installation for automated screenshots
```bash
npm install puppeteer --save-dev
node screenshot-generator.js
```

## 📋 Screenshot Checklist

Before publishing your README:
- [ ] Login page (desktop)
- [ ] Login page (mobile) 
- [ ] Upload interface (desktop)
- [ ] Upload interface (mobile)
- [ ] File upload progress
- [ ] Server running in terminal
- [ ] File browser/listing
- [ ] Error states (optional)
- [ ] API responses (Postman/curl)

## 🎯 Pro Tips for Great Screenshots

1. **Use realistic demo data** - Don't use "test.txt", use "Annual_Report_2024.pdf"
2. **Show the product in action** - Include upload progress, file lists
3. **Consistent styling** - Same browser, same zoom level
4. **Mobile-first** - Show responsive design works
5. **Clean interface** - Hide browser bookmarks, use incognito mode
6. **High resolution** - Use retina displays when possible
7. **Annotations** - Add arrows or highlights to important features

---

# 🖥️ Server Installation

## 🐧 Ubuntu Server Installation

### Step 1: Update System
```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git build-essential
```

### Step 2: Install Node.js
```bash
# Install Node.js 20.x LTS (recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show v10.x.x
```

### Step 3: Install Redis
```bash
# Install Redis server
sudo apt install redis-server -y

# Configure Redis (optional - for security)
sudo nano /etc/redis/redis.conf
# Uncomment and set: bind 127.0.0.1
# Set: requirepass your_secure_password

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify Redis is running
redis-cli ping  # Should return PONG
```

### Step 4: Create FileDrop Directory
```bash
# Create application directory
sudo mkdir -p /opt/filedrop
cd /opt/filedrop

# Set permissions
sudo chown $USER:$USER /opt/filedrop
```

### Step 5: Setup FileDrop Application
```bash
# Create package.json
cat > package.json << 'EOF'
{
  "name": "filedrop-server",
  "version": "2.1.0",
  "description": "FileDrop Server - Secure File Upload System",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "pm2:start": "pm2 start server.js --name filedrop",
    "pm2:stop": "pm2 stop filedrop",
    "pm2:restart": "pm2 restart filedrop"
  },
  "dependencies": {
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1",
    "redis": "^4.6.5",
    "cors": "^2.8.5",
    "chalk": "^4.1.2",
    "chokidar": "^3.5.3",
    "uuid": "^9.0.0",
    "express-session": "^1.17.3"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  },
  "keywords": ["file", "upload", "server", "nodejs", "redis"],
  "author": "FileDrop Team",
  "license": "MIT",
  "engines": {
    "node": ">=16.0.0",
    "npm": ">=8.0.0"
  }
}
EOF

# Install dependencies
npm install

# Install PM2 for process management (recommended)
sudo npm install -g pm2
```

### Step 6: Create Configuration
```bash
# Create config.json
cat > config.json << 'EOF'
{
  "server": {
    "port": 3000,
    "uploadPath": "./uploads"
  },
  "auth": {
    "enabled": true,
    "username": "admin",
    "passwordHash": "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9",
    "apiKey": "filedrop-secure-api-key-2024"
  },
  "cleanup": {
    "deleteAfterDownload": false,
    "keepFilesForDays": 7,
    "autoCleanupInterval": 24
  }
}
EOF

# Create uploads directory
mkdir -p uploads
```

### Step 7: Copy Server Code
```bash
# Create server.js file and copy the complete code from the artifact
nano server.js
# Paste the complete server.js code here
```

### Step 8: Setup Firewall
```bash
# Open port 3000
sudo ufw allow 3000/tcp
sudo ufw reload

# Check firewall status
sudo ufw status
```

### Step 9: Start FileDrop Server
```bash
# Method 1: Direct start (for testing)
npm start

# Method 2: Using PM2 (recommended for production)
pm2 start server.js --name "filedrop"
pm2 startup  # Follow the instructions to enable auto-start
pm2 save

# Check status
pm2 status
pm2 logs filedrop  # View logs
```

### Step 10: Setup Systemd Service (Alternative to PM2)
```bash
# Create systemd service file
sudo tee /etc/systemd/system/filedrop.service > /dev/null << 'EOF'
[Unit]
Description=FileDrop Server
After=network.target redis.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/filedrop
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable filedrop
sudo systemctl start filedrop

# Check status
sudo systemctl status filedrop
```

---

## 🪟 Windows Server Installation

### Step 1: Install Node.js
1. **Download Node.js**:
   - Visit https://nodejs.org
   - Download **LTS version** (recommended)
   - Run the `.msi` installer

2. **Verify Installation**:
   ```cmd
   # Open Command Prompt or PowerShell
   node --version
   npm --version
   ```

### Step 2: Install Redis
**Option A: Using WSL (Recommended)**
```cmd
# Install WSL2
wsl --install
# Restart computer when prompted

# After restart, install Redis in WSL
wsl
sudo apt update
sudo apt install redis-server -y
redis-server --daemonize yes
```

**Option B: Redis for Windows**
1. Download from: https://github.com/tporadowski/redis/releases
2. Download `Redis-x64-*.msi` 
3. Run installer and follow setup wizard
4. Redis will start automatically as Windows service

**Option C: Using Docker**
```cmd
# Install Docker Desktop first
# Then run Redis container
docker run -d --name redis -p 6379:6379 redis:latest
```

### Step 3: Create FileDrop Directory
```cmd
# Create directory
mkdir C:\FileDrop
cd C:\FileDrop
```

### Step 4: Setup FileDrop Application
```cmd
# Create package.json
echo {> package.json
echo   "name": "filedrop-server",>> package.json
echo   "version": "2.1.0",>> package.json
echo   "description": "FileDrop Server - Secure File Upload System",>> package.json
echo   "main": "server.js",>> package.json
echo   "scripts": {>> package.json
echo     "start": "node server.js",>> package.json
echo     "dev": "nodemon server.js">> package.json
echo   },>> package.json
echo   "dependencies": {>> package.json
echo     "express": "^4.18.2",>> package.json
echo     "multer": "^1.4.5-lts.1",>> package.json
echo     "redis": "^4.6.5",>> package.json
echo     "cors": "^2.8.5",>> package.json
echo     "chalk": "^4.1.2",>> package.json
echo     "chokidar": "^3.5.3",>> package.json
echo     "uuid": "^9.0.0",>> package.json
echo     "express-session": "^1.17.3">> package.json
echo   }>> package.json
echo }>> package.json

# Install dependencies
npm install

# Install PM2 globally (optional but recommended)
npm install -g pm2
```

### Step 5: Create Configuration Files
```cmd
# Create config.json
echo {> config.json
echo   "server": {>> config.json
echo     "port": 3000,>> config.json
echo     "uploadPath": "./uploads">> config.json
echo   },>> config.json
echo   "auth": {>> config.json
echo     "enabled": true,>> config.json
echo     "username": "admin",>> config.json
echo     "passwordHash": "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9",>> config.json
echo     "apiKey": "filedrop-secure-api-key-2024">> config.json
echo   },>> config.json
echo   "cleanup": {>> config.json
echo     "deleteAfterDownload": false,>> config.json
echo     "keepFilesForDays": 7,>> config.json
echo     "autoCleanupInterval": 24>> config.json
echo   }>> config.json
echo }>> config.json

# Create uploads directory
mkdir uploads
```

### Step 6: Copy Server Code
- Create `server.js` file
- Copy the complete server code from the artifact
- Or use notepad:
```cmd
notepad server.js
```

### Step 7: Configure Windows Firewall
```cmd
# Open PowerShell as Administrator
# Add firewall rule for port 3000
netsh advfirewall firewall add rule name="FileDrop Server" dir=in action=allow protocol=TCP localport=3000

# Or use Windows Firewall GUI:
# Control Panel > System and Security > Windows Defender Firewall > Advanced Settings
# Inbound Rules > New Rule > Port > TCP > 3000 > Allow
```

### Step 8: Create Startup Scripts

**start-filedrop.bat**:
```batch
@echo off
title FileDrop Server Startup
echo Starting FileDrop Server...
echo.

REM Check if Redis is running
echo Checking Redis connection...
redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo Starting Redis server...
    start "Redis Server" cmd /k "redis-server"
    timeout /t 5
) else (
    echo Redis is already running.
)

REM Start FileDrop server
echo Starting FileDrop application...
cd /d "%~dp0"
npm start

pause
```

**start-filedrop-pm2.bat** (if using PM2):
```batch
@echo off
title FileDrop Server (PM2)
echo Starting FileDrop Server with PM2...
echo.

REM Start with PM2
cd /d "%~dp0"
pm2 start server.js --name "filedrop"
pm2 logs filedrop

pause
```

### Step 9: Install as Windows Service (Advanced)
```cmd
# Install node-windows
npm install -g node-windows

# Create service installer script (install-service.js)
echo var Service = require('node-windows').Service; > install-service.js
echo. >> install-service.js
echo var svc = new Service({ >> install-service.js
echo   name:'FileDrop Server', >> install-service.js
echo   description: 'FileDrop File Upload Server', >> install-service.js
echo   script: 'C:\\FileDrop\\server.js' >> install-service.js
echo }); >> install-service.js
echo. >> install-service.js
echo svc.on('install',function(){ >> install-service.js
echo   svc.start(); >> install-service.js
echo }); >> install-service.js
echo. >> install-service.js
echo svc.install(); >> install-service.js

# Run as administrator
node install-service.js
```

---

# 💻 Client Setup

## 🐧 Ubuntu Client Setup

### GUI Access (Desktop Environment)
1. **Open Web Browser**:
   ```bash
   # Firefox
   firefox http://SERVER_IP:3000
   
   # Chrome
   google-chrome http://SERVER_IP:3000
   
   # Default browser
   xdg-open http://SERVER_IP:3000
   ```

### Command Line Access
```bash
# Install curl for API access
sudo apt install curl -y

# Test server connection
curl -s http://SERVER_IP:3000/api/health

# Upload file via API
curl -X POST -H "X-API-Key: filedrop-secure-api-key-2024" \
  -F "files=@/path/to/your/file.txt" \
  http://SERVER_IP:3000/api/upload

# Get pending jobs
curl -H "X-API-Key: filedrop-secure-api-key-2024" \
  http://SERVER_IP:3000/api/jobs/pending
```

### Create Desktop Shortcut
```bash
# Create desktop file
cat > ~/Desktop/FileDrop.desktop << 'EOF'
[Desktop Entry]
Name=FileDrop Server
Comment=Access FileDrop File Upload System
Exec=firefox http://SERVER_IP:3000
Icon=applications-internet
Terminal=false
Type=Application
Categories=Network;
EOF

# Make executable
chmod +x ~/Desktop/FileDrop.desktop
```

## 🪟 Windows Client Setup

### Browser Access
1. **Open any browser**:
   - Chrome: `chrome.exe http://SERVER_IP:3000`
   - Edge: `msedge.exe http://SERVER_IP:3000`
   - Firefox: `firefox.exe http://SERVER_IP:3000`

2. **Create Desktop Shortcut**:
   - Right-click on Desktop
   - New > Shortcut
   - Enter: `http://SERVER_IP:3000`
   - Name: "FileDrop Server"

### Command Line Access (PowerShell)
```powershell
# Test connection
Invoke-RestMethod -Uri "http://SERVER_IP:3000/api/health"

# Upload file
$headers = @{ "X-API-Key" = "filedrop-secure-api-key-2024" }
$form = @{ files = Get-Item "C:\path\to\file.txt" }
Invoke-RestMethod -Uri "http://SERVER_IP:3000/api/upload" -Method POST -Headers $headers -Form $form

# Get pending jobs
Invoke-RestMethod -Uri "http://SERVER_IP:3000/api/jobs/pending" -Headers $headers
```

### Windows API Client Script
Create `upload-file.ps1`:
```powershell
param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,
    
    [string]$ServerUrl = "http://localhost:3000",
    [string]$ApiKey = "filedrop-secure-api-key-2024"
)

$headers = @{ "X-API-Key" = $ApiKey }

try {
    if (-not (Test-Path $FilePath)) {
        throw "File not found: $FilePath"
    }
    
    Write-Host "Uploading file: $FilePath"
    $form = @{ files = Get-Item $FilePath }
    $response = Invoke-RestMethod -Uri "$ServerUrl/api/upload" -Method POST -Headers $headers -Form $form
    
    Write-Host "Upload successful!" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Depth 2)"
} catch {
    Write-Host "Upload failed: $($_.Exception.Message)" -ForegroundColor Red
}
```

Usage:
```powershell
# Upload single file
.\upload-file.ps1 -FilePath "C:\Documents\file.pdf"

# Upload to remote server
.\upload-file.ps1 -FilePath "C:\Documents\file.pdf" -ServerUrl "http://192.168.1.100:3000"
```

---

# ⚙️ Configuration

## config.json Options

```json
{
  "server": {
    "port": 3000,                    // Server port
    "uploadPath": "./uploads"        // Upload directory path
  },
  "auth": {
    "enabled": true,                 // Enable/disable authentication
    "username": "admin",             // Login username
    "passwordHash": "sha256_hash",   // SHA256 hash of password
    "apiKey": "your-secure-api-key"  // API key for clients
  },
  "cleanup": {
    "deleteAfterDownload": false,    // Delete files after download
    "keepFilesForDays": 7,          // Keep files for N days
    "autoCleanupInterval": 24       // Cleanup interval in hours
  }
}
```

## Environment Variables
Create `.env` file (optional):
```bash
PORT=3000
UPLOAD_PATH=./uploads
REDIS_URL=redis://localhost:6379
NODE_ENV=production
```

## Password Hash Generation
```javascript
// Generate password hash
const crypto = require('crypto');
const password = 'your_password';
const hash = crypto.createHash('sha256').update(password).digest('hex');
console.log('Password hash:', hash);
```

---

# 🎯 Usage

## Web Interface
1. **Access the server**: `http://SERVER_IP:3000`
2. **Login**: Use configured username/password
3. **Upload files**: Drag & drop or click to select
4. **Monitor progress**: Real-time upload tracking

## API Usage

### Authentication
```bash
# API Key in headers
curl -H "X-API-Key: your-api-key" ...

# Or web session login
curl -X POST -d "username=admin&password=your_password" \
  http://SERVER_IP:3000/api/login
```

### Upload Files
```bash
curl -X POST -H "X-API-Key: your-api-key" \
  -F "files=@file1.txt" \
  -F "files=@file2.pdf" \
  http://SERVER_IP:3000/api/upload
```

### Get File List
```bash
curl -H "X-API-Key: your-api-key" \
  http://SERVER_IP:3000/api/jobs/pending
```

### Download File
```bash
curl -H "X-API-Key: your-api-key" \
  -O http://SERVER_IP:3000/api/download/JOB_ID
```

---

# 📚 API Documentation

## Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/health` | Health check | No |
| POST | `/api/login` | Web login | No |
| POST | `/api/logout` | Web logout | Session |
| POST | `/api/upload` | Upload files | Yes |
| GET | `/api/jobs/pending` | List pending jobs | Yes |
| GET | `/api/download/:jobId` | Download file | Yes |
| POST | `/api/jobs/:jobId/complete` | Mark job complete | Yes |
| GET | `/api/status` | Server status | Yes |

## Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation completed",
  "data": { ... }
}
```

### Error Response
```json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "hint": "Helpful hint (optional)"
}
```

---

# 🔧 Troubleshooting

## Common Issues

### 1. Cannot Connect to Redis
**Ubuntu:**
```bash
# Check Redis status
sudo systemctl status redis-server

# Start Redis
sudo systemctl start redis-server

# Check Redis logs
sudo journalctl -u redis-server
```

**Windows:**
```cmd
# Check if Redis is running
tasklist | findstr redis

# Start Redis manually
redis-server

# Or restart Redis service
net stop Redis
net start Redis
```

### 2. Port 3000 Already in Use
```bash
# Find process using port 3000
# Linux:
sudo lsof -i :3000
# Windows:
netstat -ano | findstr :3000

# Kill process
# Linux:
sudo kill -9 PID
# Windows:
taskkill /F /PID 1234
```

### 3. Permission Issues
**Ubuntu:**
```bash
# Fix upload directory permissions
sudo chown -R $USER:$USER /opt/filedrop/uploads
chmod 755 /opt/filedrop/uploads
```

**Windows:**
```cmd
# Run as administrator or check folder permissions
# Right-click folder > Properties > Security > Edit
```

### 4. File Upload Fails
- Check file size limit (500MB default)
- Verify disk space available
- Check upload directory permissions
- Monitor server logs for detailed errors

### 5. Authentication Issues
- Verify config.json auth settings
- Check password hash generation
- Ensure API key matches client configuration
- Clear browser cookies/session data

## Log Analysis

**PM2 Logs:**
```bash
pm2 logs filedrop --lines 100
```

**Systemd Logs (Ubuntu):**
```bash
sudo journalctl -u filedrop -f
```

**Windows Event Logs:**
```cmd
# If running as Windows service
eventvwr.msc
```

## Performance Optimization

### Server Optimization
```bash
# Increase file upload limits in nginx (if used)
client_max_body_size 500M;

# Node.js memory limit
node --max-old-space-size=4096 server.js

# PM2 cluster mode
pm2 start server.js -i max --name filedrop-cluster
```

### Redis Optimization
```bash
# Increase Redis memory limit
# Edit /etc/redis/redis.conf
maxmemory 1gb
maxmemory-policy allkeys-lru
```

---

## 📞 Support

For issues, feature requests, or contributions:
- 🐛 **Bug Reports**: Create detailed issue reports
- 💡 **Feature Requests**: Suggest new functionality  
- 📖 **Documentation**: Improve this guide
- 🔧 **Contributions**: Submit pull requests

## 📄 License

MIT License - Feel free to use, modify, and distribute.

---

**🎉 Congratulations! Your FileDrop server should now be up and running!**

**Quick Test:**
1. Start your server
2. Visit `http://localhost:3000` (or your server IP)
3. Login with username: `admin`, password: `admin123`
4. Upload a test file
5. Verify it appears in the uploads folder

**Default Credentials:**
- Username: `admin`
- Password: `admin123`
- API Key: `filedrop-secure-api-key-2024`

**Remember to change these defaults in production!**