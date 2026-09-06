# Medhira AI

**Medhira** comes from the Sanskrit-inspired idea of *Medhā* — wisdom, intelligence, intellect. Medhira AI is a chat companion built around that idea: a clean, calm interface with Claude (by Anthropic) doing the thinking.

## Features

- Chat with Claude in a polished, purple/lavender-themed interface
- "Medhira is thinking…" typing indicator, plus a smooth reveal animation for replies
- New Chat with a confirmation prompt if you have an unsaved conversation
- Chat history saved locally in your browser (`localStorage`) — reopen or delete any past conversation
- Settings panel: Light / Dark / System theme, five AI personalities, and free-text custom instructions
- Fully responsive — desktop, tablet, and mobile (sidebar collapses into a slide-in menu)
- Accessible: labeled controls, keyboard navigation, visible focus states, reduced-motion support
- Your Anthropic API key **never** touches the browser — all requests go through a Netlify serverless function

## Technology used

- HTML, CSS, vanilla JavaScript (no frontend framework)
- [Netlify Functions](https://docs.netlify.com/functions/overview/) as a secure backend
- [Claude API](https://docs.claude.com/) (Anthropic Messages API)

## Project structure

```
medhira-ai/
├── index.html
├── style.css
├── script.js
├── netlify.toml
├── package.json
├── .gitignore
├── .env.example
└── netlify/
    └── functions/
        └── chat.js
```

## How the Claude connection works

1. You type a message in the browser and hit **Enter** (or tap send).
2. `script.js` sends your whole conversation so far — plus your chosen personality and any custom instructions — to `/.netlify/functions/chat`. This is a same-site request, so no API key is involved on the frontend at all.
3. `netlify/functions/chat.js` runs on Netlify's servers. It reads your Anthropic API key from the environment variable `ANTHROPIC_API_KEY`, and uses it to call Anthropic's Messages API (`https://api.anthropic.com/v1/messages`).
4. Claude's reply comes back to the function, which forwards **only the reply text** to the browser. The key itself is never sent back to the browser, logged to the console on the client, or written anywhere in the UI.

This is why the app *must* be deployed somewhere that can run serverless functions (like Netlify) — a plain static host cannot keep the key secret.

## Where the API key lives

The key lives in exactly one place: the **Netlify environment variable** `ANTHROPIC_API_KEY`. It is read inside `netlify/functions/chat.js` via `process.env.ANTHROPIC_API_KEY`. It is:

- Never written into `index.html`, `style.css`, or `script.js`
- Never committed to Git (see `.env.example` for local testing — copy it to `.env` and keep `.env` out of Git; `.gitignore` already excludes it)
- Never returned in any API response to the browser

## Running locally

You'll want the [Netlify CLI](https://docs.netlify.com/cli/get-started/) so the serverless function works locally too (opening `index.html` directly in a browser will not run the function).

```bash
npm install -g netlify-cli

# from inside the medhira-ai folder
cp .env.example .env
# edit .env and paste your real Anthropic API key

netlify dev
```

`netlify dev` will start a local server (usually `http://localhost:8888`) that serves the site **and** runs `netlify/functions/chat.js`, reading `ANTHROPIC_API_KEY` from your local `.env` file.

## Deploying to Netlify

### 1. Push the project to GitHub

```bash
cd medhira-ai
git init
git add .
git commit -m "Initial commit: Medhira AI"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/medhira-ai.git
git push -u origin main
```

(Create the empty repository on GitHub first, then swap in its URL above.)

### 2. Connect GitHub to Netlify

1. Log in to [app.netlify.com](https://app.netlify.com).
2. Click **Add new site → Import an existing project**.
3. Choose **GitHub**, authorize Netlify if asked, and select your `medhira-ai` repository.
4. Build settings should be picked up automatically from `netlify.toml`:
   - **Build command:** *(leave empty — there's nothing to build)*
   - **Publish directory:** `.`
   - **Functions directory:** `netlify/functions`
5. Click **Deploy site**.

### 3. Configure the `ANTHROPIC_API_KEY` environment variable

1. In your new Netlify site, go to **Site configuration → Environment variables**.
2. Click **Add a variable**.
3. Key: `ANTHROPIC_API_KEY`
4. Value: your real Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))
5. Save, then go to **Deploys** and trigger **Deploy site** again (or **Clear cache and deploy**) so the function picks up the new variable.

### 4. Test the live site

Open the Netlify URL Netlify gives you (something like `https://medhira-ai.netlify.app`), send a message, and confirm you get a real Claude reply. If something's wrong, check **Site configuration → Functions → chat → Logs** in the Netlify dashboard for the error.

## Testing the app

- **Empty message:** the send button won't submit blank input.
- **Network offline:** disconnect your network and send a message — you'll see a friendly error, not a raw stack trace.
- **Missing key:** if `ANTHROPIC_API_KEY` isn't set, the function returns a clear error and the UI explains the AI connection isn't configured yet, instead of crashing.
- **New chat:** start a conversation, click **New Chat** — you'll be asked to confirm, and your old conversation stays in the sidebar.
- **Theme & personality:** open **Settings**, switch theme and personality, save, and refresh the page — your choices persist.

## Security notes

- The Anthropic API key is **only** ever read server-side, inside the Netlify function.
- `.env` is excluded from Git via `.gitignore` — never commit a real key.
- The function validates and trims incoming messages before forwarding them to Anthropic, and never echoes the key back in any response, log visible to the client, or UI element.
- Basic security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) are set in `netlify.toml`.

---

Built with HTML, CSS, JavaScript, Netlify Functions, and Claude.
