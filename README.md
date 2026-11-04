# 📺 SmartSeek — Resume YouTube from Where You Left Off

SmartSeek is a Chrome extension that **automatically remembers** where you left off on YouTube videos and lets you **resume from the exact timestamp**, even if your watch history is turned off. 🔥

## ✨ Features

### Core Functionality
- 🔁 Auto-saves video progress every few seconds
- 📌 Remembers timestamps **without relying on YouTube history**
- 🧠 Smart resume — picks up where you left off when revisiting
- 🧭 Clean popup UI showing saved videos and links to resume
- 🧼 Automatic cleanup of old videos (after 45 days)
- 📊 Visual progress indicators with percentage and time remaining

### v2 Features
- ⭐ **Favorites System** — Star your favorite videos for quick access
- 🎵 **Music Video Detection** — Smart detection and separate filtering for music videos
- 🔍 **View Filtering** — Switch between Recent Saves, Music Videos, and Favourites
- ⚙️ **Enhanced Settings** — Customize default view and preferences
- 🗑️ **Bulk Management** — Delete all videos at once (with safety confirmations)
- 🔄 **Smart Sorting** — Sort by title, progress (most/least watched), or default
- 🔎 **Search Functionality** — Quickly find videos by title

## 🚀 How It Works

1. You watch any YouTube video ✅
2. SmartSeek runs silently in the background ⏱️
3. It tracks your progress and saves it locally 💾
4. When you open the same video again, it resumes from your last watched timestamp 🎯

### Using v2 Features

- **Star Videos**: Click the star icon on any video thumbnail to add it to favorites
- **Filter Views**: Use the dropdown next to the view title to switch between Recent Saves, Music Videos, and Favourites
- **Music Detection**: Enable "Save Music Videos" in settings to save only music videos, or keep it off to save all videos
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
├── playback/     # Existing YouTube progress tracking and manual-save control
├── youtube/      # YouTube-specific detection
├── library/      # Saved-video storage and types
├── settings/     # Preference storage and types
├── popup/        # Popup app, components, hooks, styles, and display helpers
└── assets/       # Bundled source assets
public/          # Extension icons and other files copied into the build
docs/            # Rebuild plan and project documentation
tests/           # Node-based storage baseline and known regressions
```

Cross-module imports use `@/`, which WXT resolves to `src/`. WXT generates its
types during `bun install`; run `bun x wxt prepare` again after changing the
entrypoint structure. `bun run compile` checks TypeScript, and the build/ZIP
scripts produce artifacts in `.output/`. Development browser auto-launch is
disabled; load and verify the extension manually.

The v3 foundation currently preserves the existing tracking, storage, and popup
behavior. The playback rewrite, storage migration, and approved Cobalt interface
will be implemented in subsequent steps.

## Reliability baseline

Run `bun run test` for the Node-based Vitest suite or `bun run test:watch` while
developing. WXT supplies the in-memory extension APIs; no browser is launched.
The suite includes two reproduced storage defects marked as expected failures,
which are reported separately from ordinary passing checks. They remain unfixed
until the persistence phase. See [the baseline and manual playback checklist](docs/reliability-baseline.md)
for the issue register, expected-failure convention, and acceptance criteria.

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
