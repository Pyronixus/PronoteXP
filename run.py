import os
import shutil
import subprocess
import sys
import threading
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
        print(f"ERREUR : Le fichier {REQUIREMENTS_FILE} n'existe pas.")
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

    if process.stdout is None:
        raise RuntimeError("La sortie du processus d'installation est indisponible.")

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
        print("\nERREUR : L'installation des dépendances a échoué.")
        input("Appuyez sur Entrée pour quitter...")
        sys.exit(1)

    print_progress_bar(
        total_packages,
        total_packages,
        prefix="   > Progrès",
        suffix="Installation terminée !",
        length=30,
    )


def stop_server(process):
    """Arrête Uvicorn et ses enfants, notamment le processus --reload."""
    if process is None:
        return

    if sys.platform == "win32":
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    else:
        if process.poll() is not None:
            return
        process.terminate()

    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()

def relay_server_output(process, line_count):
    """Réaffiche la sortie d'Uvicorn et compte ses lignes dans le terminal."""
    if process.stdout is None:
        return

    for line in process.stdout:
        sys.stdout.write(line)
        sys.stdout.flush()
        line_count[0] += line.count("\n")


def clear_uvicorn_output(line_count):
    """Efface uniquement les lignes Uvicorn affichées depuis son lancement."""
    count = line_count[0]
    if count == 0:
        return

    sys.stdout.write(f"\033[{count}A")
    for line_index in range(count):
        sys.stdout.write("\033[2K")
        if line_index < count - 1:
            sys.stdout.write("\033[1B")
    sys.stdout.write(f"\033[{max(count - 1, 0)}A\r")
    sys.stdout.flush()


def trigger_detached_cleanup():
    """Lance le nettoyage dans un processus qui attend la fin du lanceur."""
    print("\nNettoyage lancé en arrière-plan...")

    cleanup_script = f"""
import os
import shutil
import stat
import subprocess
import time
from pathlib import Path

root_dir = Path({str(ROOT_DIR)!r})
venv_dir = Path({str(VENV_DIR)!r})

def force_remove(path):
    def handle_error(function, target, error_info):
        try:
            os.chmod(target, stat.S_IWRITE)
            function(target)
        except OSError:
            pass

    for _ in range(20):
        if not path.exists():
            return
        try:
            shutil.rmtree(path, onerror=handle_error)
        except OSError:
            pass
        if not path.exists():
            return
        if os.name == "nt":
            subprocess.run(
                ["cmd", "/c", "rmdir", "/s", "/q", str(path)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        if not path.exists():
            return
        time.sleep(0.25)

time.sleep(1)
force_remove(venv_dir)
for cache_dir in root_dir.rglob("__pycache__"):
    force_remove(cache_dir)
"""

    launch_options = {
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
        "close_fds": True,
    }
    if sys.platform == "win32":
        launch_options["creationflags"] = subprocess.DETACHED_PROCESS
    else:
        launch_options["start_new_session"] = True

    subprocess.Popen([sys.executable, "-c", cleanup_script], **launch_options)


def show_shortcuts():
    """Affiche les raccourcis disponibles pendant l'exécution du serveur."""
    print("Raccourcis disponibles :")
    print("   > Ctrl+R : arrêter puis relancer le serveur")
    print("   > Ctrl+C : arrêter le serveur et supprimer venv et les caches")
    print("   > Ctrl+Alt+C : arrêter le serveur en conservant venv et les caches")


def keep_environment_shortcut_pressed():
    """Détecte Ctrl+Alt+C sans dépendre des raccourcis de la console."""
    if sys.platform != "win32":
        return False

    import ctypes

    get_key_state = ctypes.windll.user32.GetAsyncKeyState
    return all(
        get_key_state(key_code) & 0x8000
        for key_code in (0x11, 0x12, ord("C"))
    )


def start_server():
    creationflags = 0
    if sys.platform == "win32":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

    return subprocess.Popen(
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
        ],
        creationflags=creationflags,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )


def run_server():
    """Exécute le serveur et le relance avec Ctrl+R sous Windows."""
    server_process = None
    keep_environment = False

    try:
        while True:
            server_process = start_server()
            server_output_lines = [0]
            output_thread = threading.Thread(
                target=relay_server_output,
                args=(server_process, server_output_lines),
                daemon=True,
            )
            output_thread.start()

            if sys.platform == "win32":
                import msvcrt

                while server_process.poll() is None:
                    if keep_environment_shortcut_pressed():
                        print("\nArrêt du serveur en conservant l'environnement.")
                        stop_server(server_process)
                        server_process = None
                        keep_environment = True
                        return keep_environment
                    if msvcrt.kbhit():
                        key = msvcrt.getwch()
                        if key == "\x00":
                            key = f"\x00{msvcrt.getwch()}"
                        if key == "\x12":
                            stop_server(server_process)
                            output_thread.join(timeout=1)
                            clear_uvicorn_output(server_output_lines)
                            print("Redémarrage du serveur...")
                            server_process = None
                            break
                        if key == "\x03":
                            raise KeyboardInterrupt
                    time.sleep(0.1)
                else:
                    break
            else:
                server_process.wait()
                break
    except KeyboardInterrupt:
        print("\nArrêt du serveur...")
    finally:
        stop_server(server_process)

    return keep_environment


def main():
    print("============================================================")
    print("     Démarrage de l'environnement PRONOTE Exporter")
    print("============================================================")
    print()

    keep_environment = False

    try:
        print("[Étape 1/3] Préparation de l'environnement Python...")
        create_venv_with_progress()

        print("\n[Étape 2/3] Installation des dépendances...")
        install_requirements_with_progress()

        print("\n[Étape 3/3] Démarrage du serveur...")
        print("\n============================================================")
        print("Ouvrez votre navigateur à l'adresse : http://localhost:8000")
        print("============================================================\n")

        show_shortcuts()
        keep_environment = run_server()
    except KeyboardInterrupt:
        print("\nArrêt demandé par l'utilisateur.")
    finally:
        if not keep_environment:
            trigger_detached_cleanup()
        else:
            print("\nEnvironnement virtuel et caches conservés.")


if __name__ == "__main__":
    main()