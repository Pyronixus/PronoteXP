# 🤝 Contributing

Thanks for contributing to PronoteXP.

## Project structure

The repository is split into two main parts:

- **`backend/`**: FastAPI API using `pronotepy` to authenticate to PRONOTE and extract data.
- **`frontend/`**: static HTML, CSS, and JavaScript interface that collects forms, decodes QR codes, and builds the final export files.

The public API routes are:

- `/api/export/qrcode`
- `/api/export/token`
- `/api/export/credentials`

## Local setup

```bash
git clone https://github.com/<your-org>/pronotexp.git
cd pronotexp
python run.py
```

If `python` is not available on your system, use:

```bash
py run.py
```

This command creates the virtual environment, installs the dependencies from `backend/requirements.txt`, and starts the development server at:

```text
http://localhost:8000
```

The frontend is served by the FastAPI app itself, so there is no separate Node/Vite process to configure.

## Development workflow

1. Fork the project and create a feature branch.
2. Make your changes locally.
3. Run the app with `run.py` and test the relevant flow in the browser.
4. Keep the export logic and UI behavior aligned.
5. Commit with a clear, descriptive message.
6. Open a pull request describing the motivation and the impact of the change.

## Guidelines

- **Backend**: keep the export routes stateless and avoid persisting user data.
- **Frontend**: prefer the existing vanilla JS structure instead of adding a framework or new heavy dependencies.
- **Security**: never log credentials, tokens, or private student data.
- **Compatibility**: preserve the three login modes and ensure the exported JSON remains consistent.
- **Commits**: keep each commit focused on one logical change.

## Testing locally

Before opening a pull request, validate the feature in context:

- QR code export flow,
- token / URL login flow,
- credentials login flow,
- workbook generation (`.xlsx` / `.ods`),
- JSON split-file mode.

A simple local validation is to run the project, log in with a test account, export one category, and verify that the downloaded file is correctly generated.

## Reporting a bug

When opening an issue, include:

- the login mode used (QR / Token / Credentials),
- the exact error message,
- the reproduction steps,
- whether the issue happens in hosted mode or local mode.

## License

By contributing, you agree that your changes will be distributed under the project's MIT license. See [LICENSE](LICENSE) for details.
