# 📺 SmartSeek — Resume YouTube from Where You Left Off

SmartSeek is a Chrome extension that **automatically remembers** where you left off on YouTube videos and lets you **resume from the exact timestamp**, even if your watch history is turned off. 🔥

## ✨ Features

- 🔁 Auto-saves video progress every few seconds
- 📌 Remembers timestamps **without relying on YouTube history**
- 🧠 Smart resume — picks up where you left off when revisiting
- 🧭 Clean popup UI showing saved videos and links to resume
- 🧼 Automatic cleanup of old videos (after 45 days)

## 🚀 How It Works

1. You watch any YouTube video ✅
2. SmartSeek runs silently in the background ⏱️
3. It tracks your progress and saves it locally 💾
4. When you open the same video again, it resumes from your last watched timestamp 🎯

## 🧪 Tech Stack

- [WXT](https://wxt.dev) for modern Web Extension dev
- TypeScript + React (for popup UI)
- Tailwind CSS (for styling)
- Chrome Extension Manifest v3

## 🛠 Installation (for local development)

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
   - Select the zipped file from `.output` folder

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
