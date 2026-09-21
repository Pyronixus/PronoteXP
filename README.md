<div align="center">

<img src="frontend/assets/icons/506.png" alt="PronoteXP" width="120" />

# PronoteXP

**Local extraction and backup of your PRONOTE data**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)

</div>

---

## ✨ Overview

PronoteXP exports your PRONOTE data into a clean JSON export and a spreadsheet workbook. It supports the main PRONOTE categories such as grades, timetable, homework, absences, delays, punishments, news, and menus.

The interface lets you:

- choose a login mode: QR Code, Token / URL, or credentials,
- select export categories from the UI,
- download the result as JSON and as an Excel (`.xlsx`) or LibreOffice (`.ods`) workbook,
- split the JSON into one file per category using the separate-files option,
- keep everything local to the browser after the API response is received.

Three login modes are supported:

| Mode            | Description                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| **QR Code**     | Scan the PRONOTE mobile login QR code + 4-digit PIN                                                    |
| **Token / URL** | PRONOTE URL + username + session token                                                                 |
| **Credentials** | URL + username + password, with an optional ENT (MonLycée.net, Académie de Versailles, Open ENT NG...) |

## 🧠 How it works

```text
┌─────────────┐      HTTP POST       ┌────────────────────┐      pronotepy      ┌──────────┐
│  Frontend   │ ───────────────────▶ │ FastAPI backend    │ ──────────────────▶ │ PRONOTE  │
│ (index.html)│                      │ (backend/main.py)  │                     │ (ENT)    │
└─────────────┘ ◀────────────────── └────────────────────┘ ◀────────────────── └──────────┘
      │                 JSON export returned to browser
      ▼
   Local generation of XLSX / ODS + JSON download
```

1. The browser collects the login information based on the selected mode and decodes the QR code client-side with `jsQR`.
2. A request is sent to one of the backend routes: `/api/export/qrcode`, `/api/export/token`, or `/api/export/credentials`.
3. The backend authenticates with PRONOTE via `pronotepy` and extracts the requested data.
4. The result is returned to the browser where the workbook is generated locally and the files are downloaded.
5. Nothing is stored server-side and no export is persisted on the API.

## 🚀 Usage

Two ways to run PronoteXP:

- **Online**: the frontend is hosted on GitHub Pages and the backend is deployed on Render.
- **Locally**: install the dependencies and start the app from the repository with `run.py`.

See [QUICKSTART.md](QUICKSTART.md) for full setup instructions.

## 📦 Features

- Export to JSON with optional per-category split files.
- Workbook export in `.xlsx` or `.ods` via the browser.
- Automatic detection of empty categories in the UI.
- One sheet per category and metadata sheet in the generated workbook.
- Privacy-first behavior: credentials are only used for the export request and are not stored.

## 📁 Project structure

```text
PronoteXP/
├── .github/
│   └── workflows/
├── backend/
│   ├── main.py           # FastAPI server and PRONOTE extraction routes
│   └── requirements.txt
├── frontend/
│   ├── assets/
│   │   ├── icons/        # app icons
│   │   │   └── 506png ...
│   │   └── tutorial/      # step-by-step guide assets
│   ├── export.js         # Worksheet / JSON export logic
│   ├── index.html        # User interface
│   ├── script.js         # Login flow and API calls
│   └── style.css
├── run.py                # Local launcher (venv + install + uvicorn)
├── LICENSE
├── README.md
├── QUICKSTART.md
├── CONTRIBUTING.md
├── .gitignore
```

## 🔒 Privacy

Your credentials are used only during the PRONOTE session needed for the export. They are never saved to disk and no data is kept server-side after the response is sent back to the browser.

## 📄 License

Distributed under the **MIT** license. See [LICENSE](LICENSE) for the full text.

```text
MIT License
Copyright (c) 2026 Pyro
```

## 🤝 Contributing

Contributions are welcome. Before opening a pull request, read [CONTRIBUTING.md](CONTRIBUTING.md).
