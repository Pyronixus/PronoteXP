# 🤝 Contributing

Thanks for contributing to PronoteXP!

## How it works

The project consists of two independent parts:

- **`backend/`** — FastAPI API that uses `pronotepy` to connect to PRONOTE and extract data (grades, timetable, homework, absences, delays, punishments).
- **`frontend/`** — Static interface (vanilla HTML/CSS/JS) that collects credentials and calls the API.

Both communicate only through the REST routes `/api/export/qrcode`, `/api/export/token`, and `/api/export/credentials`.

## Setup

```bash
git clone https://github.com/<your-org>/pronotexp.git
cd pronotexp
python run.py
```

`run.py` creates the venv, installs dependencies, and starts the server locally at `http://localhost:8000` with auto-reload — ideal for developing on both backend and frontend at once.

## Workflow

1. Fork the repo and create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Make your changes.
3. Test locally via `run.py`.
4. Commit with a clear, descriptive message.
5. Open a pull request describing the change and its motivation.

## Guidelines

- **Backend**: follow the existing typing (Pydantic / type hints), keep export routes stateless (no user data storage).
- **Frontend**: don't add dependencies without reason; styling follows the CSS variables already defined in `style.css`.
- **Security**: no credentials, passwords, or tokens should ever be logged or persisted.
- **Commits**: one commit = one logical change.

## Reporting a bug

Open an issue with:
- The login mode used (QR / Token / Credentials)
- The exact error message
- Steps to reproduce

## License

By contributing, you agree that your changes will be distributed under the project's **MIT** license — see [LICENSE](LICENSE).