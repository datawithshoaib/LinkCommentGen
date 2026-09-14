# LinkedIn Comment Generator

Generate natural LinkedIn comment suggestions with OpenRouter models. This repository contains:

- A Streamlit app in `app.py` that reads a LinkedIn post from the clipboard and generates 4 or 5 comments.
- A Chrome/Chromium Manifest V3 popup in `linkedin-comment-extension/` that generates comments from pasted text.

## Requirements

- Python 3.10 or newer
- An OpenRouter API key
- Google Chrome or another Chromium-based browser for the extension

## Streamlit app

1. Create and activate a virtual environment:

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

2. Install dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

3. Create a `.env` file in the project root:

   ```env
   OPENROUTER_API_KEY=your_openrouter_api_key
   ```

4. Start the app:

   ```powershell
   streamlit run app.py
   ```

5. Copy a LinkedIn post to the system clipboard, then use **Paste & Generate** in the app. Select the tone, length, number of comments, and model before generating.

## Browser extension

1. Open `chrome://extensions` in Chrome or the equivalent extensions page in your browser.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the `linkedin-comment-extension` folder.
5. Open the extension, paste a LinkedIn post, choose the options, and select **Generate Comments**.

The extension sends requests directly from the popup to OpenRouter. On first use, it asks for an OpenRouter API key and stores it in the browser's extension storage. Do not distribute this client-side extension as a shared production service; prefer routing requests through a protected backend for multi-user deployments.

## Security

- Never commit `.env` or API keys.
- Rotate any OpenRouter key that has been exposed in source code, chat, screenshots, or public repositories.
- Review and remove exposed credentials before sharing this project.

## Project structure

```text
.
|- app.py
|- requirements.txt
`- linkedin-comment-extension/
   |- manifest.json
   |- popup.css
   |- popup.html
   `- popup.js
```

