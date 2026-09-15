import os
import shutil
import subprocess
import sys
import time
import venv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.resolve()
VENV_DIR = ROOT_DIR / "venv"
REQUIREMENTS_FILE = ROOT_DIR / "backend" / "requirements.txt"

if sys.platform == "win32":
    VENV_PYTHON = VENV_DIR / "Scripts" / "python.exe"
else:
    VENV_PYTHON = VENV_DIR / "bin" / "python"


def print_progress_bar(iteration, total, prefix="", suffix="", length=30, fill="█"):
    """Affiche une barre de progression dans le terminal et efface la fin de ligne."""
    percent = f"{100 * (iteration / float(total)):.1f}"
    filled_length = int(length * iteration // total)
    bar = fill * filled_length + "░" * (length - filled_length)
    sys.stdout.write(f"\r{prefix} |{bar}| {percent}% {suffix}\033[K")
    sys.stdout.flush()
    if iteration == total:
        sys.stdout.write("\n")


def create_venv_with_progress():
    """Crée l'environnement virtuel en affichant une progression."""
    if VENV_DIR.exists():
        print("   > Environnement virtuel existant trouvé.")
        return

    print("   > Création de l'environnement virtuel en cours...")
    env_builder = venv.EnvBuilder(with_pip=True)

    import threading

    done = False

    def build_env():
        nonlocal done
        env_builder.create(VENV_DIR)
        done = True

    thread = threading.Thread(target=build_env)
    thread.start()

    step = 0
    total_steps = 50
    while not done:
        if step < total_steps - 1:
            step += 1
        print_progress_bar(
            step, total_steps, prefix="   > Progrès", suffix="Création", length=30
        )
        time.sleep(0.1)

    thread.join()
    print_progress_bar(
        total_steps,
        total_steps,
        prefix="   > Progrès",
        suffix="Terminé !",
        length=30,
    )


def install_requirements_with_progress():
    """Installe les dépendances en affichant le paquet en cours."""
    if not REQUIREMENTS_FILE.exists():
        print(f"ERROR: Le fichier {REQUIREMENTS_FILE} n'existe pas.")
        sys.exit(1)

    with open(REQUIREMENTS_FILE, "r", encoding="utf-8") as f:
        lines = [
            line.strip()
            for line in f
            if line.strip() and not line.startswith("#")
        ]
    total_packages = max(len(lines), 1)

    cmd = [
        str(VENV_PYTHON),
        "-m",
        "pip",
        "install",
        "-r",
        str(REQUIREMENTS_FILE),
    ]

    process = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    )

    installed_count = 0
    print_progress_bar(
        0,
        total_packages,
        prefix="   > Progrès",
        suffix="Démarrage",
        length=30,
    )

    for line in process.stdout:
        if "Collecting" in line or "Processing" in line:
            parts = line.split()
            if len(parts) > 1:
                package_name = parts[1].split("==")[0].split(">=")[0].split("<=")[0]
                if installed_count < total_packages:
                    installed_count += 1
                print_progress_bar(
                    installed_count,
                    total_packages,
                    prefix="   > Progrès",
                    suffix=f"Installation de {package_name}",
                    length=30,
                )

    process.wait()

    if process.returncode != 0:
        print("\nERROR: L'installation des dépendances a échoué.")
        input("Appuyez sur Entrée pour quitter...")
        sys.exit(1)

    print_progress_bar(
        total_packages,
        total_packages,
        prefix="   > Progrès",
        suffix="Installation terminée !",
        length=30,
    )


def trigger_detached_cleanup():
    """Lance la suppression dans un sous-processus complètement indépendant."""
    print("\n[Cleaning] Lancement du nettoyage en arrière-plan...")

    cleanup_script = f"""
import shutil, time, sys
from pathlib import Path

root_dir = Path(r"{ROOT_DIR}")
venv_dir = Path(r"{VENV_DIR}")

time.sleep(1)

if venv_dir.exists():
    for _ in range(5):
        try:
            shutil.rmtree(venv_dir)
            break
        except Exception:
            time.sleep(0.5)

for pycache in root_dir.rglob("__pycache__"):
    try:
        shutil.rmtree(pycache)
    except Exception:
        pass
"""

    subprocess.Popen(
        [sys.executable, "-c", cleanup_script],
        creationflags=subprocess.DETACHED_PROCESS if sys.platform == "win32" else 0,
        close_fds=True,
    )


def main():
    print("============================================================")
    print("     Starting the PRONOTE Exporter environment")
    print("============================================================")
    print()

    try:
        print("[Progress 1/3] Preparing the Python environment...")
        create_venv_with_progress()

        print("\n[Progress 2/3] Installing dependencies...")
        install_requirements_with_progress()

        print("\n[Progress 3/3] Starting the server...")
        print("\n============================================================")
        print("Open your browser at: http://localhost:8000")
        print("============================================================\n")

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
    finally:
        trigger_detached_cleanup()


if __name__ == "__main__":
    main()