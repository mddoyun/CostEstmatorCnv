# Gemini Code-along Agent Context

This document provides context for the Gemini code-along agent to understand the project structure, technologies, and development conventions.

## Project Overview

This project is a comprehensive Cost Estimator application designed for the AEC (Architecture, Engineering, and Construction) industry. It consists of a central web application and integrations with Blender and Autodesk Revit.

The core of the project is a **Django web application** that serves as the backend. It provides a REST API and uses WebSockets (via Django Channels) for real-time communication with the client applications. The backend handles data storage (using SQLite), business logic, and serves the frontend. The project also includes machine learning libraries like TensorFlow and Keras, indicating features related to AI-based estimation.

The **frontend** is a complex single-page application (SPA) written in vanilla JavaScript. It provides a rich user interface for managing project data, defining rulesets for quantity takeoff, managing cost codes, and performing cost estimations.

The project includes two key integrations:

*   A **Blender Add-on**: This add-on connects to the Django server via WebSockets. It can extract IFC data (geometry and properties) from a Blender project and send it to the server. It also allows the web application to control Blender, for example, by selecting elements in the 3D view.
*   A **Revit Add-in**: This is a .NET-based add-in for Autodesk Revit. Similar to the Blender add-on, it connects to the server via WebSockets, enabling data exchange and control between Revit and the web application.

The backend server is designed to be packaged into a standalone executable using PyInstaller for easy distribution with the Blender and Revit add-ins.

## Building and Running

### Backend Server

The backend is a Django application.

**Dependencies:**

*   Python dependencies are listed in `requirements.txt`. Install them using `pip install -r requirements.txt`.
*   The project uses a virtual environment located in the `.mddoyun` directory.

**Running the server:**

You can run the development server using the standard Django `manage.py` script:

```bash
python manage.py runserver
```

Alternatively, you can use the `run_server.py` script, which is also the entry point for the PyInstaller build:

```bash
python run_server.py
```

**Building the executable:**

The `run_server.py` file contains the commands to build the server executable using PyInstaller for both macOS and Windows.

For macOS:
```bash
pyinstaller --name "CostEstimatorServer" \
--onefile \
--add-data "db.sqlite3:." \
--add-data "aibim_quantity_takeoff_web:aibim_quantity_takeoff_web" \
--add-data "connections:connections" \
run_server.py
```

For Windows:
```bash
pyinstaller --name "CostEstimatorServer" --onefile --add-data "db.sqlite3;." --add-data "aibim_quantity_takeoff_web;aibim_quantity_takeoff_web" --add-data "connections;connections" run_server.py
```

### Frontend

The frontend is built with vanilla JavaScript. There is no separate build process for the frontend. The static files (like `main.js`) are served directly by the Django application.

### Blender Add-on

The Blender add-on is located in the `CostEstimator_BlenderAddon_453` directory. To use it, this directory should be installed as a Blender add-on. The add-on includes the pre-built server executables.

### Revit Add-in

The Revit add-in is a .NET project located in the `CostEstimator_RevitAddin_2026` directory. It can be built using Visual Studio or the .NET CLI. The project is configured to copy the necessary files to the Revit Add-ins directory upon a successful build.

## Development Conventions

*   **Python:** The Python code follows standard Django conventions.
*   **JavaScript:** The frontend code is written in a single large JavaScript file (`connections/static/connections/main.js`). It does not use a modern framework, so changes should be made carefully to maintain consistency.
*   **Blender/Revit:** The add-on/add-in code should follow the respective platform's conventions and best practices.
*   **WebSockets:** Communication between the clients (Blender, Revit, web frontend) and the server is done via JSON messages over WebSockets. The message format should be kept consistent.
