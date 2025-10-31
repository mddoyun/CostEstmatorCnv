# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AEC (Architecture, Engineering & Construction) cost estimation web application built with Django. The system integrates with Blender and Autodesk Revit through WebSocket connections to enable real-time 3D model-based cost estimation with advanced quantity takeoff and BIM data processing capabilities.

**Core Technology Stack:**
- **Backend**: Django 5.2+ with Channels (WebSocket support via Daphne)
- **Database**: SQLite with UUID primary keys
- **Frontend**: Vanilla JavaScript (no framework - 32 modular JS files)
- **3D Visualization**: Three.js with CSG operations (ThreeBSP) for geometry splitting
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
   - `models.py`: Database models (Project, RawElement, QuantityClassificationTag, CostCode, etc.)
   - `consumers.py`: WebSocket consumers (RevitConsumer, BlenderConsumer, FrontendConsumer)
   - `routing.py`: WebSocket URL routing
   - `views.py`: HTTP views and API endpoints
   - `static/connections/`: Frontend JavaScript files (32 modules)
   - `templates/`: HTML templates (revit_control.html as main SPA)

### Database Models (Key Entities)

The data model uses UUIDs as primary keys throughout. Core models include:

- **Project**: Top-level container for all project data
- **RawElement**: Stores BIM elements with raw IFC/Revit data (JSON)
  - Supports element splitting with parent-child relationships
  - `is_active` flag for soft deletion
  - `split_metadata` JSON field for split history
- **QuantityClassificationTag**: Classification tags for quantity takeoff (e.g., "건축_골조_슬래브_RC")
- **CostCode**: Construction cost codes with detailed specifications
  - `code`: Unique identifier code
  - `name`: Cost code name (이름)
  - `detail_code`: Detailed specification code
  - `note`: Additional notes/description
  - Many-to-many relationship with QuantityMember
- **AIModel**: Stores trained ML models (.h5 files) as binary data with metadata
- **QuantityMember**: Aggregated quantity calculation results
  - Links RawElements to classifications
  - Stores calculated properties and quantities
  - Supports split objects with volume-based distribution
- **MemberMark**: Identification marks for quantity members (일람부호)
- **CostItem**: Cost estimation items (산출항목)
  - Links QuantityMembers to cost codes
  - Grouping and aggregation support
- **UnitPrice/UnitPriceType**: Unit price management system
- **Space**: Hierarchical space structure for spatial analysis
- **Activity**: Construction activities for scheduling
- **ProjectCalendar**: Working day calendars

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
- Support for geometry data transmission for 3D visualization

### Frontend Architecture

The frontend is a complex SPA built with vanilla JavaScript, organized into 32 modular files:

**Core Files:**
- `app.js`: Event listener setup and initialization
- `app_core.js`: Core application state and data management
- `websocket.js`: WebSocket connection and message handling
- `ui.js`: UI utilities and rendering functions (including ruleset table renderers)
- `navigation.js`: Navigation and view switching
- `csrf_token.js`: CSRF token management utility

**Feature Modules:**
- `project_management_handlers.js`: Project CRUD operations
- `data_management_handlers.js`: Element data management with helper panel
- `tag_management_handlers.js`: Classification tag management
- `cost_code_management_handlers.js`: Cost code management
- `member_mark_management_handlers.js`: Member mark management
- `space_management_handlers.js`: Space hierarchy management
- `activity_management_handlers.js`: Construction activity management
- `calendar_management_handlers.js`: Project calendar management
- `ai_model_management.js`: AI model upload/training/management
- `quantity_members_manager.js`: Quantity calculation management
- `cost_item_manager.js`: Cost item management
- `unit_price_management.js`: Unit price database management
- `boq_detailed_estimation_handlers.js`: Bill of quantities (상세견적/DD)
  - Detailed cost estimation with customizable column display
  - Real-time unit price integration
  - Split object support
- `schematic_estimation_handlers.js`: Schematic estimation (개산견적/SD)
- `gantt_chart_handlers.js`: Gantt chart visualization

**Ruleset Handlers:**
All ruleset handlers now support user-friendly condition builder UI:
- `ruleset_classification_handlers.js`: Classification rule assignment
- `ruleset_property_mapping_handlers.js`: Property extraction/transformation rules
  - Condition builder for RawElement properties
  - Mapping builder for key-value transformations
- `ruleset_cost_code_handlers.js`: Cost code assignment rules
  - Condition builder for QuantityMember properties
  - Mapping builder for quantity calculations
- `ruleset_member_mark_assignment_handlers.js`: Member mark assignment rules
- `ruleset_cost_code_assignment_handlers.js`: Cost code assignment rules
- `ruleset_space_classification_handlers.js`: Space classification rules
- `ruleset_space_assignment_handlers.js`: Space assignment rules
- `ruleset_activity_assignment_handlers.js`: Activity assignment rules

**3D Visualization:**
- `three_d_viewer.js`: Three.js based 3D viewer with advanced features
  - Interactive object selection (single/multi/window/crossing)
  - Camera controls (orbit/fly mode with WASD+QE+Shift)
  - Sketch mode for CAD-style object splitting
  - Geometry manipulation using CSG operations
  - Unit price and property display on hover
- `ThreeBSP.js`: Boolean operations library for geometry splitting

**Data Flow:**
1. BIM data loaded from Revit/Blender via WebSocket
2. Stored in `allRevitData` global array
3. Geometry data processed and rendered in 3D viewer
4. Processed through rulesets for classification and quantity calculation
5. Results stored in database and rendered in tables/views
6. Real-time updates propagated via WebSocket

### Ruleset System

The ruleset system is the core of the application's automation logic. Each ruleset type has a specific purpose:

**Classification Rulesets** (`ruleset_classification_handlers.js`)
- Assign QuantityClassificationTags to RawElements based on properties
- UI: Condition builder with RawElement property dropdowns
- Conditions based on: Category, Family, Type, Level, Parameters, TypeParameters

**Property Mapping Rulesets** (`ruleset_property_mapping_handlers.js`)
- Extract and transform RawElement properties into QuantityMember properties
- UI: Condition builder + mapping script builder
- Supports template expressions: `{Category}`, `{Parameters.속성명}`
- Recently improved with horizontal scrolling and fixed column widths

**Cost Code Rulesets** (`ruleset_cost_code_handlers.js`)
- Assign CostCodes to QuantityMembers and calculate quantities
- UI: Condition builder (for QM properties) + mapping builder (for quantity formulas)
- Conditions based on: name, classification_tag, properties.*, MM.*, RE.*
- Recently improved from JSON textarea to user-friendly builders
- Displays conditions as: `name == "벽"` instead of JSON
- Mapping displayed as: `길이: {Parameters.길이}` format

**Member Mark Assignment Rulesets** (`ruleset_member_mark_assignment_handlers.js`)
- Assign identification marks to QuantityMembers
- Pattern-based marking with auto-increment support

**Cost Code Assignment Rulesets** (`ruleset_cost_code_assignment_handlers.js`)
- Link QuantityMembers to CostCodes
- Can reference MemberMark properties (MM.*)

**Space Rulesets** (`ruleset_space_classification_handlers.js`, `ruleset_space_assignment_handlers.js`)
- Create and assign spatial hierarchies
- Support for room/floor/building structures

**Activity Assignment Rulesets** (`ruleset_activity_assignment_handlers.js`)
- Link quantity members to construction activities
- Integration with scheduling features

### UI/UX Improvements

**Condition Builder Pattern:**
- Replaces JSON textarea inputs with dropdown-based interface
- Property selection from actual BIM data
- Operator selection (==, !=, contains, startsWith, endsWith, etc.)
- Value input field
- Add/remove buttons for dynamic condition management
- Implemented in: Property Mapping and Cost Code rulesets
- Internal storage remains JSON for compatibility

**Mapping Builder Pattern:**
- Key-value pair interface for property mapping
- Add/remove buttons for dynamic mapping management
- Supports template expressions with curly braces
- Used in: Property Mapping and Cost Code rulesets

**Helper Panels:**
- BIM Raw Data tab has a helper panel on the right side
- Shows selected object's properties in table format
- Properties displayed in ruleset-usable format: `{PropertyName}`
- System properties, Parameters, TypeParameters grouped separately
- Scrollable with fixed column widths (40% property, 60% value)

**Table Layout:**
- Most ruleset tables use horizontal scrolling
- Fixed column widths with min-width constraints
- Word-wrap and vertical alignment for better readability
- Consistent styling across all ruleset types

### External Integrations

**Blender Addon** (`CostEstimator_BlenderAddon_453/`)
- Python-based addon for Blender 4.2+
- Extracts IFC data using ifcopenshell
- Extracts geometry for 3D visualization
- WebSocket client connects to Django server
- Can bundle Django server executable for standalone distribution

**Revit Addin** (`CostEstimator_RevitAddin_2026/`)
- .NET 8.0 Windows application
- C# codebase integrating with Revit API
- WebSocket client for real-time communication
- Geometry extraction with transformation matrices
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
- UUID primary keys throughout

### JavaScript Code
- Vanilla JS, no build process required
- Global variables used for application state (e.g., `currentProjectId`, `allRevitData`)
- Event delegation patterns for dynamic UI elements
- Modular organization by feature area (32 files)
- Heavy use of `console.log` for debugging
- Naming convention for handler files: `<feature>_handlers.js` or `<feature>_manager.js`

### WebSocket Messaging
- All messages use JSON format with `type` and `payload` structure
- Progress tracking messages include total/count fields for long operations
- Element data transfers use chunking (typical chunk size: 500-1000 elements)
- Geometry data sent separately for 3D visualization

### Database
- All tables use UUID primary keys
- Many-to-many relationships used for tags and classifications
- JSON fields store raw BIM data and ruleset configurations
- Unique constraints on (project, name/code) combinations
- Soft deletion pattern with `is_active` flags

### UI Patterns
- Condition Builder: dropdown-based rule condition input
- Mapping Builder: key-value pair mapping interface
- Helper Panels: contextual property reference panels
- Split Layouts: main content + details panel pattern
- Fixed column widths + horizontal scrolling for wide tables

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
- Split objects maintain parent-child relationships

### Adding a New Ruleset Type

1. Create handler file: `ruleset_<type>_handlers.js`
2. Implement load function: `load<Type>Rules()`
3. Implement render function using condition builder pattern
4. Implement save/delete functions
5. Add event handlers in `app.js`
6. Create table renderer in `ui.js` if needed
7. Update navigation in `navigation.js`

### Using Condition Builder

```javascript
// 1. Render edit mode with condition builder
const conditions = rule.conditions || [];
let conditionsHtml = '<div class="conditions-builder">';
conditions.forEach((cond, idx) => {
    conditionsHtml += renderConditionRowForQM(cond, idx); // or renderConditionRowForRE
});
conditionsHtml += '<button class="add-condition-btn">+ 조건 추가</button></div>';

// 2. Set up listeners
setupConditionBuilderListeners();

// 3. Collect data on save
const conditionRows = ruleRow.querySelectorAll('.condition-row');
const conditions = [];
conditionRows.forEach(row => {
    conditions.push({
        property: row.querySelector('.condition-property').value,
        operator: row.querySelector('.condition-operator').value,
        value: row.querySelector('.condition-value').value
    });
});
```

### Using Mapping Builder

```javascript
// 1. Render edit mode with mapping builder
const mappingScript = rule.mapping_script || {};
let mappingsHtml = '<div class="mappings-builder">';
Object.entries(mappingScript).forEach(([key, value], idx) => {
    mappingsHtml += renderMappingRow(key, value, idx);
});
mappingsHtml += '<button class="add-mapping-btn">+ 맵핑 추가</button></div>';

// 2. Collect data on save
const mappingRows = ruleRow.querySelectorAll('.mapping-row');
const mapping_script = {};
mappingRows.forEach(row => {
    const key = row.querySelector('.mapping-key-input').value.trim();
    const value = row.querySelector('.mapping-value-input').value.trim();
    if (key && value) mapping_script[key] = value;
});
```

## 3D Viewer Features

### Selection Modes
- **Single Select**: Click on individual objects
- **Multi Select**: Ctrl/Cmd+Click to add to selection
- **Window Select**: Drag box (left-to-right) for fully enclosed objects
- **Crossing Select**: Drag box (right-to-left) for any intersecting objects

### Camera Controls
- **Orbit Mode** (default): Mouse drag to rotate, wheel to zoom
- **Fly Mode** (F key): WASD movement, QE up/down, Shift for speed boost

### Sketch Mode
- Draw 2D lines and polygons on object faces
- Automatic plane snapping
- Split objects along sketch boundaries
- CSG boolean operations for geometry manipulation

### Split Object Handling
- Parent-child relationships preserved
- Volume-based quantity distribution
- Split metadata stored for history tracking
- Recursive splitting supported

## Testing & Debugging

- Use browser DevTools console for frontend debugging (extensive console.log usage)
- Backend debug prints visible in Django console
- WebSocket messages logged on both client and server sides
- Test with Revit 2026 or Blender 4.2+ for integration testing
- Check `workings/` folder for detailed change logs

## Recent Major Updates (2025-10-30 to 2025-11-01)

1. **CostCode Model Enhancement**: Added `detail_code` and `note` fields
2. **BOQ UI Improvements**: Customizable column display, unit price integration
3. **3D Viewer Enhancements**: Multi-select, window/crossing selection, fly mode
4. **Split Object Support**: Volume-based quantity distribution, recursive splitting
5. **Ruleset UI Overhaul**: Condition builder and mapping builder for user-friendly rule creation
6. **Helper Panel Addition**: BIM raw data properties displayed for ruleset reference
7. **Table Layout Fixes**: Horizontal scrolling with fixed column widths across all rulesets

## Important Notes

- The frontend state is managed globally - no state management framework
- Large datasets handled via chunking in WebSocket transfers
- Database writes are synchronous wrapped in async functions for Channels compatibility
- PyInstaller builds require careful inclusion of Django static files and templates
- CSRF tokens handled via custom utility (`csrf_token.js`)
- All ruleset conditions internally stored as JSON but displayed in user-friendly format
- 3D viewer requires WebGL support and uses Three.js r128+
- Split objects affect quantity calculations through volume ratios

## Documentation Files

- `/workings/`: Detailed change logs organized by date
- `/CLAUDE.md`: This file (English)
- `/claude_kor.md`: Korean version of project documentation
- `/gemini.md`: Documentation for Gemini AI assistant
- Ruleset-specific docs: See `/docs/rulesets/` folder (when created)
