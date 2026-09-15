<div align="center">

<img src="frontend/assets/506.png" alt="PronoteXP" width="120" />

# PronoteXP

**Local extraction and backup of your PRONOTE data**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)

</div>

---

## ✨ Overview

PronoteXP exports your PRONOTE data (grades, timetable, homework, absences, delays, punishments...) into a single `export_pronote.json` file, downloadable directly from your browser.

Three login modes are supported:

| Mode | Description |
|---|---|
| **QR Code** | Scan of the PRONOTE mobile login QR code + PIN code |
| **Token / URL** | Establishment URL + username + session token |
| **Credentials** | Username + password, with or without an ENT (MonLycée.net, Académie de Versailles, Open ENT NG...) |

## 🧠 How it works

```
┌─────────────┐      POST request        ┌──────────────────┐      pronotepy      ┌──────────┐
│  Frontend    │ ───────────────────────▶ │   FastAPI backend │ ──────────────────▶ │ PRONOTE  │
│ (index.html) │                          │     (main.py)      │                     │ (ENT)    │
└─────────────┘ ◀─────────────────────── └──────────────────┘ ◀────────────────── └──────────┘
      │                 export_pronote.json (JSON)
      ▼
   Local download
```

1. The frontend (`index.html` / `script.js`) collects your login credentials based on the selected mode, and decodes the QR code client-side via `jsQR`.
2. A request is sent to the backend API (`/api/export/qrcode`, `/api/export/token`, or `/api/export/credentials`).
3. The backend uses [`pronotepy`](https://github.com/bain3/pronotepy) to log into your PRONOTE account and extract all available data.
4. The generated JSON is returned to the browser and offered for download — nothing is stored server-side.

## 🚀 Usage

Two ways to run PronoteXP:

- **Online**: the frontend is hosted on GitHub Pages and talks to a backend API deployed on Render — no installation needed.
- **Locally**: spin up everything (venv, dependencies, server) with a single command via `run.py`.

See [QUICKSTART.md](QUICKSTART.md) for the details of both methods.

## 📁 Project structure

```
pronotexp/
├── backend/
│   ├── main.py           # FastAPI API (export routes + pronotepy)
│   └── requirements.txt
├── frontend/
│   ├── assets/
│   │   ├── 32.png
│   │   ├── 192.png
│   │   └── 506.png
│   ├── index.html
│   ├── script.js
│   └── style.css
├── run.py                # Local launcher (venv + install + uvicorn)
├── LICENSE
├── README.md
├── QUICKSTART.md
└── CONTRIBUTING.md
```

## 🔒 Privacy

Your credentials only pass through for the duration of a single request to PRONOTE and are **never saved**. No data is persisted server-side: the generated export is sent straight back to the browser.

## 📄 License

Distributed under the **MIT** license. See the [LICENSE](LICENSE) file for the full text.

```
MIT License
Copyright (c) 2026 Pyro
```

## 🤝 Contributing

Contributions are welcome! Check out [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
