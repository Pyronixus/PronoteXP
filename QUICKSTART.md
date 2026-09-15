# 🚀 Quickstart

Two ways to use PronoteXP.

## 1. Online (GitHub Pages)

No installation required. The frontend is served statically from GitHub Pages and automatically calls the API deployed on Render.

1. Open the project's GitHub Pages site.
2. Pick your login mode (QR Code / Token / Credentials).
3. Click **Export data**.
4. Select the categories from the dropdown, choose Excel (`.xlsx`) or LibreOffice (`.ods`), then download the JSON and table file. Enable separate-files mode to remove selected categories from the main JSON and create one table file per category.

> The first call may take a few seconds while the free Render instance wakes up.

## 2. Locally with `run.py`

Requirements: **Python 3.9+**.

```bash
git clone https://github.com/<your-org>/pronotexp.git
cd pronotexp
python run.py
```
>**Note :** If `python run.py`return an error please consider adding python to the path or retry with `py run.py`

`run.py` handles everything:

1. Creates a virtual environment (`venv/`) if it doesn't exist.
2. Installs dependencies (`backend/requirements.txt`).
3. Starts the Uvicorn server with auto-reload.

Once running, open:

```
http://localhost:8000
```

The frontend is served directly by the FastAPI backend (`StaticFiles`) — no extra configuration needed.

## Login modes

| Mode | Required fields |
|---|---|
| QR Code | PRONOTE QR code image + PIN code (4 digits) |
| Token / URL | PRONOTE URL, username, session token |
| Credentials | PRONOTE URL, ENT (optional), username, password |

## Stopping the server

`Ctrl + C` in the terminal.