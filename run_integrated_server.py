#!/usr/bin/env python3
"""
통합 서버 런처 - Django + Ollama
macOS 및 Windows 모두 지원
"""

import os
import sys
import shutil
import subprocess
import time
import signal
import platform
from pathlib import Path
from django.core.management import execute_from_command_line

# 전역 프로세스 관리
ollama_process = None


def is_windows():
    """Windows 플랫폼 확인"""
    return platform.system() == 'Windows'


def is_macos():
    """macOS 플랫폼 확인"""
    return platform.system() == 'Darwin'


def find_ollama_executable():
    """
    Ollama 실행파일 경로 찾기
    Returns: (경로, 존재여부)
    """
    if is_windows():
        # Windows: 일반적인 설치 경로들
        possible_paths = [
            Path(os.environ.get('LOCALAPPDATA', '')) / 'Programs' / 'Ollama' / 'ollama.exe',
            Path(os.environ.get('PROGRAMFILES', '')) / 'Ollama' / 'ollama.exe',
            Path(os.environ.get('PROGRAMFILES(X86)', '')) / 'Ollama' / 'ollama.exe',
        ]
    elif is_macos():
        # macOS: Homebrew 또는 시스템 설치
        possible_paths = [
            Path('/opt/homebrew/bin/ollama'),  # Apple Silicon
            Path('/usr/local/bin/ollama'),     # Intel Mac
            Path.home() / '.local' / 'bin' / 'ollama',
        ]
    else:
        # Linux
        possible_paths = [
            Path('/usr/local/bin/ollama'),
            Path('/usr/bin/ollama'),
            Path.home() / '.local' / 'bin' / 'ollama',
        ]

    # which/where 명령어로 확인
    try:
        cmd = 'where' if is_windows() else 'which'
        result = subprocess.run([cmd, 'ollama'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            path = Path(result.stdout.strip().split('\n')[0])
            if path.exists():
                return str(path), True
    except Exception:
        pass

    # 미리 정의된 경로 확인
    for path in possible_paths:
        if path.exists():
            return str(path), True

    return None, False


def is_ollama_running():
    """Ollama 서버가 이미 실행 중인지 확인"""
    try:
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex(('127.0.0.1', 11434))
        sock.close()
        return result == 0
    except Exception:
        return False


def start_ollama_server(ollama_path):
    """
    Ollama 서버 시작
    Returns: subprocess.Popen 객체 또는 None
    """
    global ollama_process

    if is_ollama_running():
        print("[INFO] Ollama server is already running on port 11434")
        return None

    try:
        print(f"[INFO] Starting Ollama server from: {ollama_path}")

        # 백그라운드로 ollama serve 실행
        if is_windows():
            # Windows: CREATE_NEW_PROCESS_GROUP 플래그로 독립적인 프로세스 생성
            ollama_process = subprocess.Popen(
                [ollama_path, 'serve'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
            )
        else:
            # macOS/Linux: 표준 백그라운드 실행
            ollama_process = subprocess.Popen(
                [ollama_path, 'serve'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=os.setpgrp  # 새로운 프로세스 그룹 생성
            )

        # 서버 시작 대기 (최대 30초)
        print("[INFO] Waiting for Ollama server to start...")
        for i in range(30):
            if is_ollama_running():
                print("[OK] Ollama server started successfully")
                return ollama_process
            time.sleep(1)
            if i % 5 == 4:
                print(f"[INFO] Still waiting... ({i+1}s)")

        print("[WARNING] Ollama server did not respond within 30 seconds")
        return ollama_process

    except Exception as e:
        print(f"[ERROR] Failed to start Ollama server: {e}")
        return None


def check_ollama_models(ollama_path):
    """설치된 Ollama 모델 확인 및 추천"""
    try:
        result = subprocess.run(
            [ollama_path, 'list'],
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode == 0:
            models = result.stdout.strip()
            if models:
                print("\n[INFO] Installed Ollama models:")
                print(models)

                # llama 모델 확인
                if 'llama' in models.lower():
                    print("[OK] Llama model detected")
                else:
                    print("[WARNING] No Llama model found")
                    print("[INFO] To install: ollama pull llama3.2:3b")
            else:
                print("[WARNING] No Ollama models installed")
                print("[INFO] To install: ollama pull llama3.2:3b")

    except Exception as e:
        print(f"[WARNING] Could not check Ollama models: {e}")


def cleanup_ollama():
    """Ollama 프로세스 정리"""
    global ollama_process

    if ollama_process:
        try:
            print("\n[INFO] Stopping Ollama server...")
            if is_windows():
                # Windows: CTRL_BREAK_EVENT 전송
                ollama_process.send_signal(signal.CTRL_BREAK_EVENT)
            else:
                # macOS/Linux: SIGTERM 전송
                ollama_process.terminate()

            # 종료 대기 (최대 5초)
            try:
                ollama_process.wait(timeout=5)
                print("[OK] Ollama server stopped")
            except subprocess.TimeoutExpired:
                print("[WARNING] Ollama server did not stop gracefully, forcing...")
                ollama_process.kill()
                ollama_process.wait()
                print("[OK] Ollama server killed")

        except Exception as e:
            print(f"[WARNING] Error stopping Ollama: {e}")


def setup_django_environment():
    """Django 환경 설정"""
    # 데이터 폴더 생성
    try:
        writable_dir = Path.home() / "CostEstimator_Data"
        writable_dir.mkdir(exist_ok=True)
        print(f"[OK] Data folder checked: {writable_dir}")
    except Exception as e:
        print(f"[ERROR] Could not create data folder: {e}")
        input("Press Enter to exit...")
        sys.exit(1)

    # 데이터베이스 복사
    db_path = writable_dir / "db.sqlite3"
    if not db_path.exists():
        try:
            if getattr(sys, 'frozen', False):
                source_db_path = Path(sys._MEIPASS) / "db.sqlite3"
            else:
                source_db_path = Path(__file__).parent / "db.sqlite3"

            if source_db_path.exists():
                shutil.copy2(source_db_path, db_path)
                print("[OK] Initial database copied.")
            else:
                print("[WARNING] Original database file (db.sqlite3) not found.")
        except Exception as e:
            print(f"[ERROR] Failed to copy database: {e}")
            input("Press Enter to exit...")
            sys.exit(1)

    # Django 환경 설정
    os.chdir(writable_dir)
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aibim_quantity_takeoff_web.settings')

    return writable_dir


def run_django_server():
    """Django 서버 실행"""
    try:
        # 마이그레이션 실행
        print("\n--- Starting database migration ---")
        execute_from_command_line([sys.argv[0], 'migrate'])
        print("--- Database migration complete ---\n")

        # 서버 실행
        print("=" * 60)
        print("[INFO] Django server starting at http://127.0.0.1:8000")
        print("[INFO] Ollama API available at http://127.0.0.1:11434")
        print("[INFO] Press Ctrl+C to stop all servers")
        print("=" * 60)

        execute_from_command_line([sys.argv[0], 'runserver', '--noreload'])

    except KeyboardInterrupt:
        print("\n[INFO] Server shutdown command received")
    except Exception as e:
        print(f"[FATAL ERROR] An error occurred while running Django: {e}")
        import traceback
        traceback.print_exc()
        input("Press Enter to exit...")
    finally:
        cleanup_ollama()


def main():
    """메인 실행 함수"""
    print("=" * 60)
    print("CostEstimator Integrated Server Launcher")
    print("Django + Ollama AI")
    print("=" * 60)
    print(f"Platform: {platform.system()} {platform.release()}")
    print(f"Python: {sys.version.split()[0]}")
    print("=" * 60)

    # 1. Ollama 확인 및 시작
    ollama_path, ollama_exists = find_ollama_executable()

    if ollama_exists:
        print(f"[OK] Ollama found: {ollama_path}")
        check_ollama_models(ollama_path)
        start_ollama_server(ollama_path)
    else:
        print("[WARNING] Ollama not found on this system")
        print("[INFO] Please install Ollama from: https://ollama.ai")
        print("[INFO] Continuing without Ollama (AI features will be limited)")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            sys.exit(0)

    # 2. Django 환경 설정 및 실행
    setup_django_environment()
    run_django_server()


if __name__ == '__main__':
    main()


"""
========================================
빌드 방법
========================================

[macOS]
-------
pyinstaller --name "CostEstimator" \
  --onefile \
  --add-data "db.sqlite3:." \
  --add-data "aibim_quantity_takeoff_web:aibim_quantity_takeoff_web" \
  --add-data "connections:connections" \
  run_integrated_server.py

실행파일 위치: dist/CostEstimator


[Windows]
---------
pyinstaller --name "CostEstimator" ^
  --onefile ^
  --add-data "db.sqlite3;." ^
  --add-data "aibim_quantity_takeoff_web;aibim_quantity_takeoff_web" ^
  --add-data "connections;connections" ^
  run_integrated_server.py

실행파일 위치: dist\CostEstimator.exe


[주의사항]
---------
1. 각 플랫폼에서 해당 플랫폼용 실행파일을 빌드해야 합니다
   - macOS에서는 macOS용만 빌드 가능
   - Windows에서는 Windows용만 빌드 가능

2. Ollama는 별도 설치 필요:
   - macOS: brew install ollama
   - Windows: https://ollama.ai 에서 다운로드

3. Ollama 모델 설치:
   ollama pull llama3.2:3b

4. 실행파일은 다음을 포함:
   - Django 서버
   - Ollama 자동 감지 및 시작
   - 데이터베이스 자동 설정
   - 모든 필요한 파일

========================================
"""
