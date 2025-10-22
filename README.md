# Fireproof Todo App

A complete Fireproof application with:
- **React frontend** with local IndexedDB storage
- **Hono server** with file-based storage
- **Automatic sync** between client and server

## Architecture

This app demonstrates the key Fireproof concepts:

1. **Local Storage**: Uses IndexedDBGateway for browser-side persistence
2. **Server Storage**: Uses FileGateway for server-side persistence  
3. **Sync Protocol**: HTTP-based sync using CAR files and metadata
4. **Real-time Updates**: React components automatically update when data changes

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

### Server Side (Hono + File Storage)
- Hono server provides `/fp` endpoint for Fireproof protocol
- Handles CAR file uploads/downloads (`?car=...`)
- Handles metadata operations (`?meta=...`)
- Stores data in memory (can be extended to use FileGateway)

### Sync Mechanism
- Client connects to server using custom HTTP protocol
- Data changes are automatically synced between client and server
- Uses Fireproof's CRDT (Conflict-free Replicated Data Type) for conflict resolution
- Supports offline-first development

## API Endpoints

### Health Check
- **GET** `/health` - Returns server status

### Fireproof API
- **GET/PUT/DELETE** `/fp` - Fireproof database operations
  - Query parameters:
    - `car` - CAR file operations
    - `meta` - Metadata operations

## Project Structure

```
src/
├── server/
│   └── index.ts           # Hono server setup
├── connect/
│   ├── index.ts           # Connection exports
│   └── gateway.ts         # HTTP SerdeGateway implementation
├── App.tsx               # Main React component
├── main.tsx              # React entry point
└── config.ts             # Configuration
```

## Key Features

- ✅ **Local-first**: Works offline with IndexedDB
- ✅ **Real-time sync**: Changes sync automatically
- ✅ **Conflict resolution**: Handles concurrent edits
- ✅ **TypeScript**: Full type safety
- ✅ **Modern stack**: React 19 + Vite + Hono

## Notes

- The server uses in-memory storage for development
- CORS is enabled for frontend-backend communication
- Uses tsx for TypeScript execution in development
- Data persists in browser IndexedDB and server memory
- Sync happens automatically when both client and server are running
