#!/usr/bin/env python3
"""
Unified Server Launcher for B2B Pharmaceutical Shipment Protection System.
Starts both the FastAPI Backend and Next.js Frontend concurrently in a single process.
Handles clean shutdown on Ctrl+C.
"""

import os
import sys
import time
import signal
import socket
import subprocess
import threading
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"

def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0

def get_python_executable() -> str:
    # Check for backend_venv
    if os.name == "nt":
        venv_py = ROOT_DIR / "backend_venv" / "Scripts" / "python.exe"
    else:
        venv_py = ROOT_DIR / "backend_venv" / "bin" / "python"
        
    if venv_py.exists():
        return str(venv_py)
    return sys.executable

def stream_output(process: subprocess.Popen, prefix: str, color_code: str):
    reset_code = "\033[0m"
    try:
        for line in iter(process.stdout.readline, b""):
            decoded = line.decode("utf-8", errors="replace").rstrip()
            if decoded:
                print(f"{color_code}{prefix}{reset_code} {decoded}", flush=True)
    except Exception:
        pass

def print_banner():
    cyan = "\033[96m"
    green = "\033[92m"
    yellow = "\033[93m"
    bold = "\033[1m"
    reset = "\033[0m"
    print(f"""
{cyan}===================================================================={reset}
{bold}  B2B Pharmaceutical Shipment Protection AIoT System{reset}
{cyan}===================================================================={reset}
  {green}* Frontend Dashboard:{reset}    http://localhost:3000
  {green}* Backend API Server:{reset}    http://localhost:8000
  {green}* Swagger API Docs:{reset}      http://localhost:8000/docs
  {green}* WebSocket Feed:{reset}        ws://127.0.0.1:8000/ws/dashboard

  {yellow}Demo Accounts:{reset}
  - Admin:    admin@pharmaprotect.com    / Admin123!
  - Operator: operator@pharmaprotect.com / Operator123!
  - Manager:  manager@pharmaprotect.com  / Manager123!
  - Auditor:  viewer@pharmaprotect.com   / Viewer123!

  Press {bold}Ctrl+C{reset} anytime to stop both servers.
{cyan}===================================================================={reset}
""")

def main():
    py_bin = get_python_executable()
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"

    print(f"[*] Root directory: {ROOT_DIR}")
    print(f"[*] Python interpreter: {py_bin}")

    # Check ports
    if is_port_in_use(8000):
        print("\033[93m[!] Warning: Port 8000 is already in use. Backend might fail to bind.\033[0m")
    if is_port_in_use(3000):
        print("\033[93m[!] Warning: Port 3000 is already in use. Frontend might fail to bind.\033[0m")

    # 1. Run database initialization and seed
    print("[*] Initializing and verifying database...")
    try:
        subprocess.run([py_bin, "seed.py"], cwd=str(BACKEND_DIR), check=True)
        print("[+] Database initialized successfully.")
    except Exception as e:
        print(f"\033[91m[-] Error during seed: {e}\033[0m")

    # 2. Launch FastAPI backend
    print("[*] Starting Backend (Uvicorn on port 8000)...")
    backend_env = os.environ.copy()
    backend_env["PYTHONPATH"] = str(BACKEND_DIR) + os.pathsep + backend_env.get("PYTHONPATH", "")

    backend_proc = subprocess.Popen(
        [py_bin, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
        cwd=str(BACKEND_DIR),
        env=backend_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1
    )

    # 3. Launch Next.js frontend (use start if built, otherwise dev)
    has_build = (FRONTEND_DIR / ".next" / "BUILD_ID").exists()
    start_script = "start" if has_build else "dev"
    print(f"[*] Starting Frontend (Next.js '{start_script}' on port 3000)...")
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", start_script],
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1
    )

    # Stream logs asynchronously
    b_thread = threading.Thread(
        target=stream_output, 
        args=(backend_proc, "[BACKEND]", "\033[94m"),
        daemon=True
    )
    f_thread = threading.Thread(
        target=stream_output, 
        args=(frontend_proc, "[FRONTEND]", "\033[92m"),
        daemon=True
    )
    b_thread.start()
    f_thread.start()

    time.sleep(1)
    print_banner()

    # Graceful shutdown handler
    procs = [backend_proc, frontend_proc]
    def shutdown(signum=None, frame=None):
        print("\n[*] Stopping all services...")
        for p in procs:
            if p.poll() is None:
                try:
                    if os.name == "nt":
                        subprocess.run(["taskkill", "/F", "/T", "/PID", str(p.pid)], capture_output=True)
                    else:
                        p.terminate()
                except Exception:
                    pass
        print("[+] All services stopped.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown)

    try:
        while True:
            # Check if any process crashed unexpectedly
            if backend_proc.poll() is not None:
                print(f"\033[91m[-] Backend exited with code {backend_proc.returncode}\033[0m")
                break
            if frontend_proc.poll() is not None:
                print(f"\033[91m[-] Frontend exited with code {frontend_proc.returncode}\033[0m")
                break
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        shutdown()

if __name__ == "__main__":
    main()
