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

function App() {
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
    attach: toCloud({
      dashboardURI: "http://localhost:3001/fp/cloud/api/token",
      tokenApiURI: "http://localhost:3001/api",
      urls: { base: "http://localhost:3001?protocol=http&forceHttp=true" },
    }),
  });

  // Log database initialization
  console.log('🗄️ Database initialized:', database);
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
  const { handleAddTodo, handleToggleTodo, handleDeleteTodo } = useTodos(database);

  useEffect(() => {
    console.log('🔌 Database connection effect triggered');
    console.log('🔌 Database:', database);
    console.log('🔌 Database ledger:', database?.ledger);
    console.log('✅ Connected to local Hono server');
  }, [database]);

  
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
