# 📺 SmartSeek — Resume YouTube from Where You Left Off

SmartSeek is a Chrome extension that **automatically remembers** where you left off on YouTube videos and lets you **resume from the exact timestamp**, even if your watch history is turned off. 🔥

## ✨ Features

### Core Functionality
- 🔁 Auto-saves video progress every few seconds
- 📌 Remembers timestamps **without relying on YouTube history**
- 🧠 Smart resume — picks up where you left off when revisiting
- 🧭 Clean popup UI showing saved videos and links to resume
- 🧼 Cleanup of old non-favorite videos after 45 days (up to 100 per browser startup)
- 📊 Visual progress indicators with percentage and time remaining

### v2 Features
- ⭐ **Favorites System** — Star your favorite videos for quick access
- 🎵 **Music Video Detection** — Smart detection and separate filtering for music videos
- 🔍 **View Filtering** — Switch between Recent Saves, Music Videos, and Favourites
- ⚙️ **Enhanced Settings** — Customize default view and preferences
- 🗑️ **Bulk Management** — Delete all videos at once (with safety confirmations)
- 🔄 **Smart Sorting** — Sort by title, progress (most/least watched), or default
- 🔎 **Search Functionality** — Quickly find videos by title

### v3 development build

- Choose **Automatic** or **Only videos I choose**. Chosen videos keep their resume position updated after the first explicit save.
- Save the current video from the popup or the optional YouTube control, with acknowledged save/error feedback.
- Control automatic resume separately, browse Chosen/Completed views, and keep saves for 45 days or until deletion.
- Playback uses cancellable video sessions, restore-once rules, media/ad guards, and coordinated multi-tab checkpoints.

This is an intermediate build on `feat/v3-foundation`, still using the existing popup design and manifest version 2.0.0. Live YouTube compatibility requires owner verification. The full Cobalt interface, export/import, Undo, and sync are not implemented yet. See [playback behavior and manual checks](PLAYBACK.md).

## 🚀 How It Works

1. You watch any YouTube video ✅
2. SmartSeek runs silently in the background ⏱️
3. It tracks your progress and saves it locally 💾
4. When you open the same video again, it resumes from your last watched timestamp 🎯

### Using v2 Features

- **Star Videos**: Click the star icon on any video thumbnail to add it to favorites
- **Filter Views**: Use the dropdown next to the view title to switch between Recent Saves, Music Videos, and Favourites
- **Music Detection**: Enable "Save Music Videos" to include music videos alongside other videos
- **Customize Default View**: Set your preferred view (Recent/Music/Favourites) in Settings → Default View

## 🧪 Tech Stack

- [WXT](https://wxt.dev) for modern Web Extension dev
- TypeScript + React (for popup UI)
- Tailwind CSS (for styling)
- React Icons (for consistent iconography)
- Chrome Extension Manifest v3
- Chrome Storage API (for local data persistence)

## 🛠 Installation (for local development)

Requires Node.js 22.12 or newer and Bun.

1. Clone the repo

   ```bash
   git clone https://github.com/your-username/smartseek-extension.git
   cd smartseek-extension
   ```

2. Install dependencies

   ```bash
   bun install
   ```

3. Run the dev build

   ```bash
   bun run build
   ```

4. Create executable zip

   ```bash
   bun run zip
   ```

5. Load the extension in Chrome
   - Go to `chrome://extensions`
   - Enable "Developer Mode"
   - Click "Load unpacked"
   - Select the `.output/chrome-mv3` directory

## Project structure

```text
src/
├── entrypoints/  # WXT background/content bootstraps and popup HTML/React mount
├── background/   # Extension startup and lifecycle handlers
├── playback/     # Cancellable controller, checkpoint client, and optional save control
├── youtube/      # YouTube selectors, identity evidence, metadata, and ad observation
├── library/      # Storage client, background coordinator, migration, and record types
├── settings/     # Preference storage and types
├── shared/       # Validated extension message contracts
├── popup/        # Popup app, components, hooks, styles, and display helpers
└── assets/       # Bundled source assets
public/          # Extension icons and other files copied into the build
docs/            # Rebuild plan and project documentation
tests/           # Node-based persistence, migration, messaging, and regression tests
```

Cross-module imports use `@/`, which WXT resolves to `src/`. WXT generates its
types during `bun install`; run `bun x wxt prepare` again after changing the
entrypoint structure. `bun run compile` checks TypeScript, and the build/ZIP
scripts produce artifacts in `.output/`. Development browser auto-launch is
disabled; load and verify the extension manually.

The persistence step now routes saves and settings through one background writer,
migrates legacy data into versioned per-video records, and preserves favorites
across checkpoints. The existing popup uses this interface and reports loading,
storage failures, and migration warnings. Completed videos are retained.
The next increment adds saving modes and the playback rewrite, plus minimal controls
in the existing popup. Export/import and the approved Cobalt interface remain subsequent
steps. This is an intermediate development build, not a v3 release.
See [persistence and migration](PERSISTENCE.md) for behavior, recovery, and manual checks.

## Reliability baseline

Run `bun run test` for the Node-based Vitest suite or `bun run test:watch` while
developing. WXT supplies the in-memory extension APIs; no browser is launched.
The two reproduced storage regressions now pass as ordinary tests. The suite also
covers migration interruption/retry, worker restart, quota/write failures, retention,
durable acknowledgements, and message validation/permissions.
Playback tests use happy-dom in Node for navigation, resume, ad/media guards,
control lifecycle, coalesced saves, and failure recovery. They do not launch a browser.

## 🤝 Contributing

We welcome contributions from everyone! Here's how you can help:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Update documentation as needed
- Keep commits atomic and well-described

### Code of Conduct

Please be respectful and considerate of others when contributing to this project. We aim to foster an inclusive and welcoming community.
