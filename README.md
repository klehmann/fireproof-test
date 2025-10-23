# Fireproof Todo App

A complete Fireproof application with:
- **React frontend** with local IndexedDB storage
- **Hono server** with persistent file-based storage
- **Cross-browser data sharing** via key export/import
- **Automatic sync** between client and server

## Architecture

This app demonstrates the key Fireproof concepts:

1. **Local Storage**: Uses IndexedDBGateway for browser-side persistence
2. **Server Storage**: Uses persistent file-based storage (CAR files + metadata)
3. **Cross-Browser Sharing**: Export/import encryption keys between browsers
4. **Sync Protocol**: HTTP-based sync using CAR files and metadata
5. **Real-time Updates**: React components automatically update when data changes

## Setup

Make sure you're using Node.js version 20:

```bash
nvm use 20
```

Install dependencies:

```bash
npm install
```

## Development

Run both frontend and backend concurrently:

```bash
npm run dev
```

This will start:
- **Frontend**: Vite dev server on http://localhost:5173
- **Backend**: Hono server on http://localhost:3001

## Cross-Browser Data Sharing

To share data between different browsers:

1. **In Browser 1** (source browser):
   - Create some todos
   - Click "Export Keys" button
   - Copy the base64 string that appears

2. **In Browser 2** (target browser):
   - Click "Import Keys" button
   - Paste the base64 string from Browser 1
   - The page will reload and show the shared data

3. **Both browsers** can now:
   - See the same data
   - Make changes that sync to the server
   - Access the shared database

## Individual Commands

Run only the frontend:
```bash
npm run dev:client
```

Run only the backend:
```bash
npm run dev:server
```

Run the backend in production mode:
```bash
npm run start:server
```

## How It Works

### Client Side (React + IndexedDB)
- Uses `useFireproof` hook to create a Fireproof database
- Data is stored locally in IndexedDB using IndexedDBGateway
- React components automatically re-render when data changes
- Syncs with server using HTTP protocol

### Server Side (Hono + Persistent Storage)
- Hono server provides `/fp` endpoint for Fireproof protocol
- Handles CAR file uploads/downloads (`?car=...`)
- Handles metadata operations (`?meta=...`)
- **Persistent storage**: CAR files and metadata saved to `./data/` directory
- **Cross-browser support**: Server persists data between restarts

### Cross-Browser Data Sharing
- **Export Keys**: Click "Export Keys" button to copy encryption keys as base64 string
- **Import Keys**: Click "Import Keys" button to paste keys from another browser
- **Key Transfer**: Encryption keys are transferred via copy-paste (no server storage)
- **Data Sync**: After importing keys, browser can access shared data from server

## API Endpoints

### Health Check
- **GET** `/health` - Returns server status

### Fireproof API
- **GET/PUT/DELETE** `/fp` - Fireproof database operations
  - Query parameters:
    - `car` - CAR file operations (returns binary data)
    - `meta` - Metadata operations (returns JSON)
- **WebSocket** `/ws` - Real-time communication (optional)

## Project Structure

```
src/
├── server/
│   └── fireproof-backend.ts  # Hono server with Fireproof protocol
├── connect/
│   ├── index.ts              # Connection exports
│   └── gateway.ts            # HTTP SerdeGateway implementation
├── App.tsx                   # Main React component with key sharing
├── main.tsx                  # React entry point
└── config.ts                 # Configuration

data/                        # Persistent server storage
├── car-files/               # CAR files (binary data)
├── meta-store.json          # Metadata storage
└── key-store.json           # Key management (deprecated)
```

## Key Features

- ✅ **Local-first**: Works offline with IndexedDB
- ✅ **Real-time sync**: Changes sync automatically
- ✅ **Cross-browser sharing**: Export/import keys between browsers
- ✅ **Persistent storage**: Server data survives restarts
- ✅ **Conflict resolution**: Handles concurrent edits
- ✅ **TypeScript**: Full type safety
- ✅ **Modern stack**: React 19 + Vite + Hono

## Notes

- **Persistent storage**: Server saves CAR files and metadata to `./data/` directory
- **Cross-browser workflow**: Export keys from Browser 1 → Import keys in Browser 2 → Access shared data
- **CORS enabled**: Frontend-backend communication works across origins
- **TypeScript**: Uses tsx for TypeScript execution in development
- **Offline-first**: Data persists in browser IndexedDB and server files
- **Auto-sync**: Changes sync automatically when both client and server are running
