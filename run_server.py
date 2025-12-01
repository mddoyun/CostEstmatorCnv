# run_server.py (인코딩 문제 해결 최종 버전)
# run_server.py (최종 안정화 버전)

import os
import sys
import shutil
from pathlib import Path
from django.core.management import execute_from_command_line

def main():
    """
    This script is the entry point for the PyInstaller bundled executable.
    It handles all tasks for setting up and running the Django server without subprocesses.
    """
    # --- 1. Setup writable data folder ---
    try:
        writable_dir = Path.home() / "CostEstimator_Data"
        writable_dir.mkdir(exist_ok=True)
        print(f"[OK] Data folder checked: {writable_dir}")
    except Exception as e:
        print(f"[ERROR] Could not create data folder: {e}")
        input("Press Enter to exit...")
        sys.exit(1)

    # --- 2. Copy initial database ---
    db_path = writable_dir / "db.sqlite3"

    # Check if database file exists AND is valid (not empty/corrupted)
    # A valid database should be at least 100KB
    db_is_valid = db_path.exists() and db_path.stat().st_size > 100000

    if not db_is_valid:
        try:
            # Remove empty/corrupted file if exists
            if db_path.exists():
                print(f"[WARNING] Found invalid database file (size: {db_path.stat().st_size} bytes), removing...")
                db_path.unlink()

            # Copy fresh database
            if getattr(sys, 'frozen', False):
                source_db_path = Path(sys._MEIPASS) / "db.sqlite3"
            else:
                source_db_path = Path(__file__).parent / "db.sqlite3"

            if source_db_path.exists():
                shutil.copy2(source_db_path, db_path)
                print(f"[OK] Initial database copied (size: {db_path.stat().st_size} bytes)")
            else:
                print("[WARNING] Original database file (db.sqlite3) not found.")
        except Exception as e:
            print(f"[ERROR] Failed to copy database: {e}")
            input("Press Enter to exit...")
            sys.exit(1)
    else:
        print(f"[OK] Using existing valid database: {db_path} (size: {db_path.stat().st_size} bytes)")

    # --- 3. Configure Django environment ---
    os.chdir(writable_dir)
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aibim_quantity_takeoff_web.settings')
    # Set explicit database path so Django uses the correct location
    os.environ['DATABASE_PATH'] = str(db_path)
    print(f"[INFO] Database path set to: {db_path}")

    try:
        # --- 4. Run database migration ---
        # Django migrate는 이미 적용된 마이그레이션은 스킵하고 새로운 것만 적용합니다.
        # 기존 데이터는 유지되면서 새 테이블/필드만 추가됩니다.
        print("\n--- Checking and applying database migrations ---")
        execute_from_command_line([sys.argv[0], 'migrate', '--verbosity', '1'])
        print("--- Database migration check complete ---\n")

        # --- 5. Get port number from arguments (default: 8000) ---
        port = '8000'
        if len(sys.argv) > 1:
            try:
                port = str(int(sys.argv[1]))  # Validate port is a number
                print(f"[INFO] Using port from argument: {port}")
            except ValueError:
                print(f"[WARNING] Invalid port argument '{sys.argv[1]}', using default 8000")

        # --- 6. Run Django server ---
        server_address = f'127.0.0.1:{port}'
        print(f"[INFO] Starting Django server at http://{server_address}")
        print("[INFO] Press Ctrl+C in this window to stop the server.")

        execute_from_command_line([sys.argv[0], 'runserver', server_address, '--noreload'])

    except KeyboardInterrupt:
        print("\n[INFO] Server shutdown command received. Exiting.")
    except Exception as e:
        print(f"[FATAL ERROR] An error occurred while running Django: {e}")
        import traceback
        traceback.print_exc()
        input("Press Enter to exit...")
    finally:
        sys.exit(0)

if __name__ == '__main__':
    main()
"""
빌드방법(mac os)

pyinstaller --name "CostEstimatorServer" \
--onefile \
--add-data "db.sqlite3:." \
--add-data "aibim_quantity_takeoff_web:aibim_quantity_takeoff_web" \
--add-data "connections:connections" \
run_server.py

"""

"""
빌드방법(윈도우) - 터미널에서 실행(cmd

pyinstaller --name "CostEstimatorServer" --onefile --add-data "db.sqlite3;." --add-data "aibim_quantity_takeoff_web;aibim_quantity_takeoff_web" --add-data "connections;connections" run_server.py

"""
