I'll help format this in proper markdown with consistent spacing and structure:

# Hacker News Reader

A modern, offline-capable Hacker News reader built with React and TypeScript. Features a clean interface, offline support via IndexedDB, and PWA capabilities.

## Features

- 🔄 Real-time synchronization with Hacker News API
- 📱 Progressive Web App (PWA) support
- 💾 Offline capability with IndexedDB
- 🔖 Bookmark stories for later reading
- 🕒 Filter stories by timeframe (1 day, 7 days, 30 days)
- 📊 Sort by points or comment count
- 💬 View top comments for each story
- 📱 Responsive design for all devices

## Technology Stack

- React 18
- TypeScript
- Vite
- TailwindCSS
- Dexie.js (IndexedDB wrapper)
- Firebase (Backend API)
- PWA with Workbox

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/yourusername/hacker-news-reader.git
cd hacker-news-reader
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
```

## API Documentation

The application uses a custom Firebase backend that provides the following endpoints:

- `/api/posts` - Fetches stories from the last 30 days
- `/api/stats` - Retrieves statistics about stored stories
- `/api/manualUpdate` - Triggers a manual database update

## Development Notes

- The application uses IndexedDB for offline storage
- Stories are automatically synced every 30 minutes
- Comments are fetched on-demand from the official HN API
- Bookmarks are preserved across database updates

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this code for your own projects.