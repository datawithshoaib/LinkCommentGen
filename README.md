# LinkComment AI

A Chrome extension that suggests LinkedIn comments. When you click **Comment** on a post, a panel opens under the comment box. The extension reads the post (text, author, headline and image descriptions), and a LangGraph + Groq backend analyses it and writes several comment options. Each option takes a different angle. Click one to insert it into the comment box.

```text
.
├── backend/     FastAPI + LangChain + LangGraph + Groq (managed with uv)
└── extension/   Chrome MV3 extension: WXT + React + TypeScript + Tailwind + shadcn/ui
```

## How it works

```text
LinkedIn page ──(content script reads post)──► background worker ──HTTP──► FastAPI /api/generate
                                                                                 │
                                                LangGraph:  analyze ─► generate ─► review
                                                                         ▲            │
                                                                         └─(top up)───┘
```

1. **analyze**: Groq reads the post and returns structured output: a summary, the post type, the author's intent, the sentiment, the key points, concrete details and possible comment angles.
2. **generate**: Groq writes N options from that analysis using your tone, length, persona and style settings. The prompt pushes for specific, human-sounding comments: no "Great post!", no hashtags, no em dashes.
3. **review**: cleans each comment (strips quotes, hashtags and dashes) and drops near-duplicates. If options are missing, it loops back to **generate** and asks only for the missing ones, with up to 3 attempts.

## 1. Run the backend

You need [uv](https://docs.astral.sh/uv/) and a free Groq API key from <https://console.groq.com/keys>.

```powershell
cd backend
copy .env.example .env      # then set GROQ_API_KEY=gsk_...
uv sync
uv run python -m app.main   # serves http://127.0.0.1:8000
```

Check that it's up: <http://127.0.0.1:8000/health> should show `"groq_configured": true`.

Optional `.env` settings: `GROQ_MODEL` (default `llama-3.3-70b-versatile`), `GENERATION_TEMPERATURE`, `ANALYSIS_TEMPERATURE` and `PORT`.

Run the tests (they use a fake LLM, so no API key is needed):

```powershell
uv run pytest
```

## 2. Build and load the extension

```powershell
cd extension
npm install
npm run build               # outputs extension/.output/chrome-mv3
```

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select `extension/.output/chrome-mv3`.
3. Open LinkedIn and click **Comment** on any post. Suggestions appear under the comment box.

For development with hot reload, run `npm run dev`. It opens a separate Chrome profile that has the extension loaded.

## Using it

- **In the feed**: the panel generates suggestions automatically when a comment box opens. You can turn this off in Settings. Switch **tone** or **length** to get a new set, click ↻ to regenerate, and click a card to insert it into the box. Results are cached per post, so closing and reopening the box is free.
- **Popup → Compose**: paste any post text to generate options you can copy.
- **Popup → Settings**: set the backend URL (the connection status is shown live), the Groq model, the number of options (3–6), emojis, the default tone, *About you* (so comments stay credible to your background) and custom style instructions. Use the On/Off switch to disable the panel.

## Notes

- The panel appears only on the main comment box of a post. It doesn't appear on messaging, the "Start a post" composer, or comment replies.
- LinkedIn changes its markup often. The DOM logic is all in `extension/lib/linkedin.ts`, with layered selectors and a generic fallback. If the panel stops appearing after a LinkedIn update, look there first.
- The Groq key lives only on the backend. The extension never sees it.
- Never commit `.env` files. Rotate any key that has been exposed.
