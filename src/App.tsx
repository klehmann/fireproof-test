import './App.css'
import { registerStoreProtocol, SuperThis, toCloud, useFireproof } from 'use-fireproof'
import { useEffect } from 'react';
import { config } from './config';
import { URI } from '@adviser/cement';
import { CloudGateway } from '@fireproof/core-gateways-cloud';

// Components
import { TodoInput } from './components/TodoInput';
import { TodoList } from './components/TodoList';
import { DebugInfo } from './components/DebugInfo';
import { KeySharingSection } from './components/KeySharingSection';
import { DatabaseChangesSection } from './components/DatabaseChangesSection';

// Hooks
import { useTodos } from './hooks/useTodos';

interface AppProps {
  useCloud?: boolean;
}

// TODO: check out https://github.com/jchris/testapp/blob/main/src/App.tsx sample app

function App({ useCloud = true }: AppProps) {
  URI.protocolHasHostpart("http");
  registerStoreProtocol({
    protocol: "http",
    defaultURI() {
      return URI.from("http://localhost:3001/");
    },
    serdegateway: async (sthis: SuperThis) => {
      return new CloudGateway(sthis);
    },
  });
  
  const { database, useLiveQuery, useAllDocs } = useFireproof("fireproof-todo-app", {
    attach: useCloud ? toCloud({
      dashboardURI: "http://localhost:3001/fp/cloud/api/token",
      tokenApiURI: "http://localhost:3001/api",
      urls: { base: "http://localhost:3001?protocol=http&forceHttp=true" },
    }) : undefined,
  });

  // Handle mode switching with proper cleanup
  useEffect(() => {
    return () => {
      // Cleanup function - close and destroy database when component unmounts or useCloud changes
      console.log('🧹 Closing and destroying database connection...');
      database.close().then(() => {
        console.log('✅ Database closed successfully');
      }).catch((err) => {
        console.error('❌ Error closing/destroying database:', err);
      });
    };
  }, [useCloud]); // Re-run when useCloud changes

  // Log database initialization
  console.log('🗄️ Database initialized:', database);
  console.log('🗄️ useCloud:', useCloud);
  console.log('🗄️ Database attach:', database.attach);
  console.log('🗄️ Database ledger:', database.ledger);
  console.log('🗄️ Using shared database name: fireproof-todo-app');
  
  // Log the current FP_PRESET_ENV to verify it's still set
  console.log('🔑 Current FP_PRESET_ENV:', (window as any)[Symbol.for("FP_PRESET_ENV")]);

  const allDocs = useAllDocs();
  console.log('📄 allDocs result:', allDocs);
  console.log('📄 allDocs docs count:', allDocs.docs?.length || 0);

  const result = useLiveQuery('createdAt', {limit: 100, descending: true})
  const todos = result.docs

  // Use custom hook for todo operations
  const { handleAddTodo, handleToggleTodo, handleDeleteTodo, handleEditTodo } = useTodos(database);

  useEffect(() => {
    console.log('🔌 Database connection effect triggered');
    console.log('🔌 Database:', database);
    console.log('🔌 Database ledger:', database?.ledger);
    console.log('🔌 useCloud mode:', useCloud);
    console.log('✅ Connected to local Hono server');
  }, [database, useCloud]);

  
  return (
    <>
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <h1>🔥 Fireproof Todo App</h1>
        <p>Local storage with IndexedDB + Server sync with Hono</p>
        
        <TodoInput onAddTodo={handleAddTodo} />

        <KeySharingSection />

        <DatabaseChangesSection database={database} />

        <div style={{ marginBottom: '20px' }}>
          <h3>Todos ({todos.length})</h3>
          <TodoList 
            todos={todos as any[]} 
            onToggleTodo={handleToggleTodo} 
            onDeleteTodo={handleDeleteTodo}
            onEditTodo={handleEditTodo}
          />
        </div>

        <DebugInfo 
          database={database}
          serverUrl={config.getServerUrl()}
          totalDocuments={allDocs.docs.length}
          todoCount={todos.length}
        />
      </div>
    </>
  )
}

export default App
