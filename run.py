import os
import subprocess
import sys
import venv
from pathlib import Path

# Chemins des dossiers
ROOT_DIR = Path(__file__).parent.resolve()
VENV_DIR = ROOT_DIR / "venv"
REQUIREMENTS_FILE = ROOT_DIR / "backend" / "requirements.txt"

# Détection de l'exécutable Python dans le venv (Windows vs Unix)
if sys.platform == "win32":
    VENV_PYTHON = VENV_DIR / "Scripts" / "python.exe"
else:
    VENV_PYTHON = VENV_DIR / "bin" / "python"


def main():
    print("============================================================")
    print("     Starting the PRONOTE Exporter environment")
    print("============================================================")
    print()

    # 1. Création du venv
    print("[Progress 1/3] Preparing the Python environment...")
    if not VENV_DIR.exists():
        print("   > Creating the virtual environment...")
        venv.create(VENV_DIR, with_pip=True)
    else:
        print("   > Existing virtual environment found.")

    # 2. Installation des dépendances
    print("\n[Progress 2/3] Installing dependencies...")
    try:
        subprocess.run(
            [str(VENV_PYTHON), "-m", "pip", "install", "-r", str(REQUIREMENTS_FILE), "--quiet"],
            check=True
        )
    except subprocess.CalledProcessError:
        print("\nERROR: Dependency installation failed.")
        input("Press Enter to exit...")
        sys.exit(1)

    # 3. Lancement d'Uvicorn
    print("\n[Progress 3/3] Starting the server...")
    print("\n============================================================")
    print("Open your browser at: http://localhost:8000")
    print("============================================================\n")

    try:
        subprocess.run(
            [
                str(VENV_PYTHON),
                "-m",
                "uvicorn",
                "backend.main:app",
                "--host",
                "0.0.0.0",
                "--port",
                "8000",
                "--reload",
            ]
        )
    except KeyboardInterrupt:
        print("\nServer stopped by user.")


if __name__ == "__main__":
    main()