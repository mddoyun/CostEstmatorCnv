# 106_2025-11-20_Debug_Log_File_System.md

## Issue

**User Request**: "여전히 동일한 문젠데 내가 콘솔창을 붙여넣어줘야하는데 붙여넣기가안되는상황이야 너가 직접 웹브라우저에서 디버깅을 할 수 있도록 디버깅용 로그파일이 어디 만들어지도록 설정할수 있어?"

**Translation**: "Still the same problem, but I need to paste the console window but I can't paste. Can you set it up so that debugging log files are created somewhere so you can debug directly from the web browser?"

**Problem**: Cannot paste console output for debugging. Need log files to be created automatically for all 3 tiers (Frontend/Server/Revit).

## Solution Overview

Implemented comprehensive file logging system that saves all debug output to files:

**Log Location**: `%USERPROFILE%\CostEstimator_Data\logs\` (same as database location)

**Log Files Created**:
1. `frontend.log` - Browser console output (geometry, websocket, etc.)
2. `geometry_debug.log` - Server-side geometry processing logs
3. `revit_geometry.log` - Revit addin geometry extraction logs
4. `server_all.log` - All server debug output

## Implementation Details

### 1. Django Server Logging

**File**: `aibim_quantity_takeoff_web/settings.py`

Added Python logging configuration:

```python
# Logging configuration
LOG_DIR = Path.home() / 'CostEstimator_Data' / 'logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} {name} {message}',
            'style': '{',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
    },
    'handlers': {
        'file_all': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOG_DIR / 'server_all.log',
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 5,
        },
        'file_geometry': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOG_DIR / 'geometry_debug.log',
            'maxBytes': 10 * 1024 * 1024,
            'backupCount': 5,
        },
        'file_frontend': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOG_DIR / 'frontend.log',
            'maxBytes': 10 * 1024 * 1024,
            'backupCount': 5,
        },
    },
    'loggers': {
        'geometry': {
            'handlers': ['console', 'file_geometry'],
            'level': 'DEBUG',
        },
        'frontend': {
            'handlers': ['console', 'file_frontend'],
            'level': 'DEBUG',
        },
    },
}
```

**Features**:
- Rotating file handler (10MB max, 5 backups)
- Separate logs for different categories
- Timestamp and level in each log line

### 2. Server Geometry Logging

**File**: `connections/consumers.py`

Added geometry logger and converted print statements:

```python
import logging

geometry_logger = logging.getLogger('geometry')
frontend_logger = logging.getLogger('frontend')

# Convert print statements to logger
geometry_logger.info(f"Element {uid[:8]}... has geometry: {verts_count / 3:.0f} verts")
geometry_logger.warning(f"Element {uid[:8]}... has NULL geometry data")
```

### 3. Frontend Log Transmission

**File**: `connections/consumers.py` - FrontendConsumer

Added WebSocket message handler to receive frontend logs:

```python
async def receive(self, text_data):
    data = json.loads(text_data)
    msg_type = data.get('type')
    payload = data.get('payload', {})

    if msg_type == 'frontend_log':
        level = payload.get('level', 'INFO')
        message = payload.get('message', '')
        source = payload.get('source', 'unknown')

        if level == 'ERROR':
            frontend_logger.error(f"[{source}] {message}")
        elif level == 'WARN':
            frontend_logger.warning(f"[{source}] {message}")
        elif level == 'INFO':
            frontend_logger.info(f"[{source}] {message}")
        else:  # DEBUG
            frontend_logger.debug(f"[{source}] {message}")
        return
```

### 4. Frontend Logger Module

**File**: `connections/static/connections/logger.js` (NEW)

JavaScript utility that intercepts console.log and sends to server:

```javascript
// Send log to server
function sendLogToServer(level, message, source) {
    if (window.frontendSocket && window.frontendSocket.readyState === WebSocket.OPEN) {
        window.frontendSocket.send(JSON.stringify({
            type: 'frontend_log',
            payload: { level, message, source }
        }));
    }
}

// Manual logging
window.logToFile = function(level, message, source) {
    console.log(`[${source}]`, message);  // Also log to console
    sendLogToServer(level, message, source);
};

// Automatic geometry logging
const originalConsoleLog = console.log;
console.log = function(...args) {
    const message = args.join(' ');

    // Auto-log geometry-related messages
    if (message.includes('[3D Viewer]') || message.includes('[Geometry]') || message.includes('geometry')) {
        sendLogToServer('INFO', message, '3d-viewer');
    }

    originalConsoleLog.apply(console, args);
};
```

**Features**:
- Automatically captures geometry-related console.log
- Manual logging: `window.logToFile('INFO', 'Message', 'source')`
- Helper functions: `window.geometryLog()`, `window.geometryWarn()`, `window.geometryError()`
- Optional full console override: `window.enableAutoFileLogging()`

**HTML Integration**: `connections/templates/revit_control.html`

```html
<script src="{% static 'connections/websocket.js' %}"></script>
<script src="{% static 'connections/logger.js' %}"></script>
```

### 5. Revit File Logger

**File**: `CostEstimator_RevitAddin_2026/MainTools/QuantityTakeoff_web/RevitDataCollector.cs`

Added FileLogger class to write logs to file:

```csharp
using System.IO;

public static class FileLogger
{
    private static string logFilePath;
    private static object lockObj = new object();

    static FileLogger()
    {
        // Log file path: %USERPROFILE%\CostEstimator_Data\logs\revit_geometry.log
        string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        string logDir = Path.Combine(userProfile, "CostEstimator_Data", "logs");

        if (!Directory.Exists(logDir))
        {
            Directory.CreateDirectory(logDir);
        }

        logFilePath = Path.Combine(logDir, "revit_geometry.log");
        WriteToFile($"[INFO] Revit Geometry Logger initialized - {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
    }

    public static void LogInfo(string message)
    {
        WriteToFile($"[INFO] {DateTime.Now:yyyy-MM-dd HH:mm:ss} {message}");
        System.Diagnostics.Debug.WriteLine($"[Geometry] {message}");
    }

    public static void LogWarning(string message)
    {
        WriteToFile($"[WARN] {DateTime.Now:yyyy-MM-dd HH:mm:ss} {message}");
        System.Diagnostics.Debug.WriteLine($"[Geometry] {message}");
    }

    public static void LogError(string message)
    {
        WriteToFile($"[ERROR] {DateTime.Now:yyyy-MM-dd HH:mm:ss} {message}");
        System.Diagnostics.Debug.WriteLine($"[Geometry] {message}");
    }

    private static void WriteToFile(string message)
    {
        try
        {
            lock (lockObj)
            {
                File.AppendAllText(logFilePath, message + Environment.NewLine);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[FileLogger] Failed to write: {ex.Message}");
        }
    }
}
```

Converted all Debug.WriteLine to FileLogger:

```csharp
// Before
System.Diagnostics.Debug.WriteLine($"[Geometry] Element {element.Id.Value}: SUCCESS");

// After
FileLogger.LogInfo($"Element {element.Id.Value}: SUCCESS - {verts.Count / 3} vertices");
```

## Log File Format

### revit_geometry.log
```
[INFO] 2025-11-20 14:30:45 Revit Geometry Logger initialized
[INFO] 2025-11-20 14:31:12 Element 945123 (Basic Wall): SUCCESS - 8 vertices, 12 faces
[WARN] 2025-11-20 14:31:13 Element 945124: No vertices extracted
[ERROR] 2025-11-20 14:31:14 Element 945125: EXCEPTION - Object reference not set
```

### geometry_debug.log
```
[INFO] 2025-11-20 14:31:15 geometry Element 3f4a2b1c... has geometry: 8 verts, 12 faces, matrix=True, materials=True
[INFO] 2025-11-20 14:31:15 geometry Copied System.Geometry → Parameters.Geometry for element 3f4a2b1c...
[WARN] 2025-11-20 14:31:16 geometry Element 5d6e7f8a... has NULL geometry data
```

### frontend.log
```
[INFO] 2025-11-20 14:31:20 frontend [3d-viewer] Geometry filtering summary:
[INFO] 2025-11-20 14:31:20 frontend [3d-viewer] - Total objects in allRevitData: 2
[INFO] 2025-11-20 14:31:20 frontend [3d-viewer] - Objects with valid geometry: 2
[WARN] 2025-11-20 14:31:21 frontend [3d-viewer-geometry] Object 12345678... has Parameters but NO Geometry field
```

## Usage

### Viewing Log Files

**Windows Explorer**:
```
%USERPROFILE%\CostEstimator_Data\logs\
```

Or in file path:
```
C:\Users\YourName\CostEstimator_Data\logs\
```

**Mac/Linux**:
```
~/CostEstimator_Data/logs/
```

### Reading Logs in Real-time

**Windows CMD**:
```cmd
tail -f %USERPROFILE%\CostEstimator_Data\logs\revit_geometry.log
```

**PowerShell**:
```powershell
Get-Content "$env:USERPROFILE\CostEstimator_Data\logs\revit_geometry.log" -Wait
```

**Mac/Linux**:
```bash
tail -f ~/CostEstimator_Data/logs/revit_geometry.log
```

### Manual Logging from Browser Console

```javascript
// Log specific message
window.logToFile('INFO', 'Testing geometry rendering', '3d-viewer');

// Geometry-specific helpers
window.geometryLog('Checking buffer geometry creation');
window.geometryWarn('Missing matrix data');
window.geometryError('Failed to create mesh');

// Enable full auto-logging (all console output → file)
window.enableAutoFileLogging();
```

## Benefits

1. **No Copy-Paste Needed**: All logs automatically saved to files
2. **Persistent Debugging**: Logs survive browser refresh/close
3. **Complete Coverage**: Frontend + Server + Revit all logged
4. **Automatic Rotation**: Old logs archived, prevents disk fill
5. **Timestamp Tracking**: Exact timing of each log entry
6. **Multi-Source**: Can trace issue across entire stack

## Testing

1. **Run Server**: `python run_server.py`
2. **Open Revit**: Run addin, create wall
3. **Fetch Data**: Click "데이터가져오기" in browser
4. **Check Logs**:
   - `revit_geometry.log`: Verify Revit extracted geometry
   - `geometry_debug.log`: Verify server received and copied geometry
   - `frontend.log`: Verify browser received valid geometry

## Troubleshooting

### Log Files Not Created

Check if logs directory exists:
```bash
ls ~/CostEstimator_Data/logs/
```

If missing, manually create:
```bash
mkdir -p ~/CostEstimator_Data/logs/
```

### No Logs Written

**Revit**: Rebuild solution (Ctrl+Shift+B)
**Server**: Restart server to apply logging config
**Frontend**: Hard refresh browser (Ctrl+Shift+R)

### Too Many Logs

Logs auto-rotate at 10MB. To reduce:
- Change `maxBytes` in settings.py
- Disable auto-logging: Remove console.log override in logger.js

## Files Modified

1. `aibim_quantity_takeoff_web/settings.py` - Django logging configuration
2. `connections/consumers.py` - Server geometry logger + frontend log receiver
3. `connections/static/connections/logger.js` - NEW: Frontend logging utility
4. `connections/templates/revit_control.html` - Load logger.js
5. `CostEstimator_RevitAddin_2026/.../RevitDataCollector.cs` - FileLogger class + log calls

## Next Steps

With log files in place, debugging geometry rendering issues:

1. Check `revit_geometry.log` for extraction success/failure
2. Check `geometry_debug.log` for server copy operation
3. Check `frontend.log` for browser filtering results
4. Compare logs to identify exact point of failure

All logs timestamped, so can trace data flow through entire pipeline.
