# SmartSeek

A Chrome extension that saves YouTube playback progress and resumes videos where you left off, even with YouTube watch history turned off.

## Features

- Automatic saving or manual saving: save a video once to keep its progress updated.
- Automatic resume and a save button on YouTube or in the popup.
- Search, sorting, favorites, and filters for manually saved, music, and completed videos.
- JSON backup import/export, recovery exports, and undo for individual removals.
- Optional auto-delete after 30, 60, or 90 days without watching. Off by default; favorites are kept.
- Light, dark, and system themes with comfortable or compact layouts.

Supports regular YouTube watch pages. Shorts, live streams, and YouTube Music are not supported. Saved data stays in your browser profile; device sync is not available.

## Development

Requires Node.js 22.12 or newer and Bun.

```sh
bun install
bun run build
```

In `chrome://extensions`, enable developer mode, select **Load unpacked**, and choose `.output/chrome-mv3`. After rebuilding, reload the existing extension entry to preserve local data. Uninstalling clears it.

```sh
bun run dev      # Watch for changes
bun run compile  # Check TypeScript
bun run test     # Run tests without a browser
bun run zip      # Create the store package in .output/
```

Browser auto-launch is disabled. Verify YouTube behavior manually.

See [PRIVACY.md](PRIVACY.md) for storage, external connections, and data deletion.
