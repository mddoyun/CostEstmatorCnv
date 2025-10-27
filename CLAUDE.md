# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AEC (Architecture, Engineering & Construction) cost estimation web application built with Django. The system integrates with Blender and Autodesk Revit through WebSocket connections to enable real-time 3D model-based cost estimation.

**Core Technology Stack:**
- **Backend**: Django 5.2+ with Channels (WebSocket support via Daphne)
- **Database**: SQLite with UUID primary keys
- **Frontend**: Vanilla JavaScript (no framework - 26 modular JS files)
- **Real-time Communication**: WebSockets via Django Channels (in-memory channel layer)
- **ML/AI**: TensorFlow/Keras for cost estimation models
- **External Integrations**: Blender addon (Python) and Revit addin (.NET/C#)

## Development Setup

### Running the Server

**Standard Django development:**
```bash
python manage.py runserver
```

**Using the PyInstaller entry point:**
```bash
python run_server.py
```

The server runs on `http://127.0.0.1:8000` by default.

### Database Migrations

```bash
python manage.py migrate
```

Note: When running via `run_server.py`, migrations are executed automatically.

### Dependencies

Install Python dependencies:
```bash
pip install -r requirements.txt
```

The project uses a virtual environment located in `.mddoyun/` directory.

## Architecture

### Django Apps Structure

1. **aibim_quantity_takeoff_web/** - Main Django project configuration
   - `settings.py`: Django settings with Channels/Daphne configuration
   - `asgi.py`: ASGI application for WebSocket support
   - `urls.py`: Root URL configuration

2. **connections/** - Core application handling WebSockets and data management
   - `models.py`: Database models (Project, RawElement, QuantityClassificationTag, CostCode, AIModel, etc.)
   - `consumers.py`: WebSocket consumers (RevitConsumer, FrontendConsumer)
   - `routing.py`: WebSocket URL routing
   - `views.py`: HTTP views
   - `static/connections/`: Frontend JavaScript files
   - `templates/`: HTML templates

### Database Models (Key Entities)

The data model uses UUIDs as primary keys throughout. Core models include:

- **Project**: Top-level container for all project data
- **RawElement**: Stores BIM elements with raw IFC/Revit data (JSON)
- **QuantityClassificationTag**: Classification tags for quantity takeoff (e.g., "건축_골조_슬래브_RC")
- **CostCode**: Construction cost codes with specifications
- **AIModel**: Stores trained ML models (.h5 files) as binary data with metadata
- **QuantityMember**: Aggregated quantity calculation results
- **UnitPrice/UnitPriceType**: Unit price management system
- **Space**: Hierarchical space structure for spatial analysis

### WebSocket Communication

The application uses three WebSocket endpoints defined in `connections/routing.py`:

- `ws/revit-connector/` - Revit addin connection
- `ws/blender-connector/` - Blender addon connection
- `ws/frontend/` - Web frontend connection

**Message Protocol**: JSON messages with `type` and `payload` fields.

**Consumer Implementation**:
- Uses `AsyncWebsocketConsumer` from Django Channels
- Database operations wrapped with `@database_sync_to_async`
- Large data transfers use chunking with progress tracking

### Frontend Architecture

The frontend is a complex SPA built with vanilla JavaScript, organized into 26 modular files:

**Core Files:**
- `app.js`: Event listener setup and initialization
- `app_core.js`: Core application state and data management
- `websocket.js`: WebSocket connection and message handling
- `ui.js`: UI utilities and rendering functions
- `navigation.js`: Navigation and view switching

**Feature Modules:**
- `project_management_handlers.js`: Project CRUD operations
- `data_management_handlers.js`: Element data management
- `tag_management_handlers.js`: Classification tag management
- `cost_code_management_handlers.js`: Cost code management
- `ai_model_management.js`: AI model upload/management
- `quantity_members_manager.js`: Quantity calculation management
- `boq_detailed_estimation_handlers.js`: Bill of quantities (상세견적)
- `schematic_estimation_handlers.js`: Schematic estimation (개산견적)
- Various ruleset handlers for classification, mapping, assignment

**Data Flow:**
1. BIM data loaded from Revit/Blender via WebSocket
2. Stored in `allRevitData` global array
3. Processed through rulesets for classification and quantity calculation
4. Results stored in database and rendered in tables/views

### External Integrations

**Blender Addon** (`CostEstimator_BlenderAddon_453/`)
- Python-based addon for Blender 4.2+
- Extracts IFC data using ifcopenshell
- WebSocket client connects to Django server
- Can bundle Django server executable for standalone distribution

**Revit Addin** (`CostEstimator_RevitAddin_2026/`)
- .NET 8.0 Windows application
- C# codebase integrating with Revit API
- WebSocket client for real-time communication
- Key files: `WebSocketService.cs`, `RevitDataCollector.cs`, `RevitApiHandler.cs`

## Building for Distribution

### Backend Server Executable

**macOS:**
```bash
pyinstaller --name "CostEstimatorServer" \
  --onefile \
  --add-data "db.sqlite3:." \
  --add-data "aibim_quantity_takeoff_web:aibim_quantity_takeoff_web" \
  --add-data "connections:connections" \
  run_server.py
```

**Windows:**
```bash
pyinstaller --name "CostEstimatorServer" --onefile --add-data "db.sqlite3;." --add-data "aibim_quantity_takeoff_web;aibim_quantity_takeoff_web" --add-data "connections;connections" run_server.py
```

Output location: `dist/CostEstimatorServer` (or `.exe` on Windows)

**Runtime Behavior**: The executable creates a `~/CostEstimator_Data` folder for the writable database.

## Development Conventions

### Python Code
- Follow Django conventions and patterns
- Use `@database_sync_to_async` for database operations in async consumers
- Debug print statements are present throughout (prefixed with `[DEBUG]`, `[ERROR]`, `[INFO]`)
- Models use `DecimalField` for precise financial calculations

### JavaScript Code
- Vanilla JS, no build process required
- Global variables used for application state (e.g., `currentProjectId`, `allRevitData`)
- Event delegation patterns for dynamic UI elements
- Modular organization by feature area
- Heavy use of `console.log` for debugging

### WebSocket Messaging
- All messages use JSON format with `type` and `payload` structure
- Progress tracking messages include total/count fields for long operations
- Element data transfers use chunking (typical chunk size: 500-1000 elements)

### Database
- All tables use UUID primary keys
- Many-to-many relationships used for tags and classifications
- JSON fields store raw BIM data and ruleset configurations
- Unique constraints on (project, name/code) combinations

## Common Development Patterns

### Adding a New WebSocket Message Type

1. Add handler in appropriate consumer (`consumers.py`)
2. Add corresponding frontend handler in `websocket.js` switch statement
3. Update relevant UI handlers in feature-specific JS files

### Working with Element Data

- Elements stored in `RawElement` model with `raw_data` JSON field
- Frontend caches in `allRevitData` array
- Use `lowerValueCache` for case-insensitive property lookups
- Classification tags stored as many-to-many relationships

### Ruleset System

Rulesets define how elements are classified and processed:
- Classification rules: Assign tags to elements based on properties
- Property mapping rules: Extract/transform element properties
- Cost code assignment rules: Link elements to cost codes
- Member mark assignment rules: Assign identification marks
- Space assignment/classification rules: Spatial hierarchy management

Each ruleset type has dedicated handler files following pattern: `ruleset_<type>_handlers.js`

## Testing & Debugging

- Use browser DevTools console for frontend debugging (extensive console.log usage)
- Backend debug prints visible in Django console
- WebSocket messages logged on both client and server sides
- Test with Revit 2026 or Blender 4.2+ for integration testing

## Important Notes

- The frontend state is managed globally - no state management framework
- Large datasets handled via chunking in WebSocket transfers
- Database writes are synchronous wrapped in async functions for Channels compatibility
- PyInstaller builds require careful inclusion of Django static files and templates
- CSRF tokens handled via custom utility (`csrf_token.js`)
