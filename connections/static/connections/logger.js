// logger.js - Frontend logging utility that saves logs to server file

/**
 * Send log to server for file storage
 * @param {string} level - Log level: 'DEBUG', 'INFO', 'WARN', 'ERROR'
 * @param {string} message - Log message
 * @param {string} source - Source file/component name
 */
function sendLogToServer(level, message, source = 'frontend') {
    if (window.frontendSocket && window.frontendSocket.readyState === WebSocket.OPEN) {
        try {
            window.frontendSocket.send(JSON.stringify({
                type: 'frontend_log',
                payload: {
                    level: level,
                    message: message,
                    source: source
                }
            }));
        } catch (error) {
            // Fallback to console if WebSocket fails
            console.error('[Logger] Failed to send log to server:', error);
        }
    }
}

/**
 * Enhanced console.log that also logs to file
 * Usage: logToFile('INFO', 'Message', '3d-viewer')
 */
window.logToFile = function(level, message, source) {
    // Log to console as usual
    const prefix = `[${source}]`;
    switch(level) {
        case 'ERROR':
            console.error(prefix, message);
            break;
        case 'WARN':
            console.warn(prefix, message);
            break;
        case 'INFO':
            console.info(prefix, message);
            break;
        default:
            console.log(prefix, message);
    }

    // Send to server for file storage
    sendLogToServer(level, message, source);
};

/**
 * Override console methods to automatically log to file
 * Set to true to enable automatic logging of all console.log statements
 */
window.enableAutoFileLogging = function() {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    console.log = function(...args) {
        const message = args.join(' ');
        sendLogToServer('DEBUG', message, 'console');
        originalLog.apply(console, args);
    };

    console.info = function(...args) {
        const message = args.join(' ');
        sendLogToServer('INFO', message, 'console');
        originalInfo.apply(console, args);
    };

    console.warn = function(...args) {
        const message = args.join(' ');
        sendLogToServer('WARN', message, 'console');
        originalWarn.apply(console, args);
    };

    console.error = function(...args) {
        const message = args.join(' ');
        sendLogToServer('ERROR', message, 'console');
        originalError.apply(console, args);
    };

    console.log('[Logger] Auto file logging enabled - all console output will be saved to ~/CostEstimator_Data/logs/frontend.log');
};

/**
 * Helper functions for specific components to log to file
 */
window.geometryLog = function(message) {
    logToFile('INFO', message, '3d-viewer-geometry');
};

window.geometryWarn = function(message) {
    logToFile('WARN', message, '3d-viewer-geometry');
};

window.geometryError = function(message) {
    logToFile('ERROR', message, '3d-viewer-geometry');
};

// Enable auto logging for geometry-related console.log statements
// This intercepts specific patterns
const originalConsoleLog = console.log;
console.log = function(...args) {
    const message = args.join(' ');

    // Auto-log geometry-related messages
    if (message.includes('[3D Viewer]') || message.includes('[Geometry]') || message.includes('geometry')) {
        sendLogToServer('INFO', message, '3d-viewer');
    }

    // Call original console.log
    originalConsoleLog.apply(console, args);
};

console.log('[Logger] Geometry logging initialized - geometry-related logs will be saved to file');
