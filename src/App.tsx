import './App.css'
import { registerStoreProtocol, SuperThis, toCloud, useFireproof } from 'use-fireproof'
import { useEffect, useState } from 'react';
import { config } from './config';
import { URI } from '@adviser/cement';
import { CloudGateway } from '@fireproof/core-gateways-cloud';

interface Todo {
  _id?: string;
  text: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

function App() {
  URI.protocolHasHostpart("fpcloud");
  registerStoreProtocol({
    protocol: "fpcloud",
    defaultURI() {
      return URI.from("fpcloud://localhost:3001/");
    },
    serdegateway: async (sthis: SuperThis) => {
      return new CloudGateway(sthis);
    },
  });

  // Also register HTTP protocol handler for our local server
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

  const { database, useLiveQuery, useAllDocs, useDocument } = useFireproof("fireproof-todo-app", {
    attach: toCloud({
      dashboardURI: "http://localhost:3001/fp/cloud/api/token",
      tokenApiURI: "http://localhost:3001/api",
      urls: { base: "http://localhost:3001?protocol=http&forceHttp=true" },
    }),
  });

  const allDocs = useAllDocs();
  console.log('allDocs:', allDocs);

  const result = useLiveQuery<Todo>('createdAt', {limit: 100, descending: true})
  const todos = result.docs
  const { doc: todo, merge: mergeTodo, save: saveTodo, reset: resetTodo } = useDocument<Todo>(() => ({
    text: "",
    completed: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }))

  const [newTodoText, setNewTodoText] = useState("");

  useEffect(() => {
    console.log('database:', database);
    console.log('✅ Connected to local Hono server');
  }, [database]);

  const handleAddTodo = async () => {
    if (!newTodoText.trim()) return;

    const newTodo: Todo = {
      text: newTodoText.trim(),
      completed: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    try {
      await database.put(newTodo);
      setNewTodoText("");
      resetTodo();
    } catch (error) {
      console.error('Error adding todo:', error);
    }
  };

  const handleToggleTodo = async (todo: Todo) => {
    if (!todo._id) return;

    const updatedTodo: Todo = {
      ...todo,
      completed: !todo.completed,
      updatedAt: Date.now()
    };

    try {
      await database.put(updatedTodo);
    } catch (error) {
      console.error('Error toggling todo:', error);
    }
  };

  const handleDeleteTodo = async (todo: Todo) => {
    if (!todo._id) return;

    try {
      await database.del(todo._id);
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTodo();
    }
  };
  
  return (
    <>
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <h1>🔥 Fireproof Todo App</h1>
        <p>Local storage with IndexedDB + Server sync with Hono</p>
        
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Add a new todo..."
            style={{
              padding: '10px',
              fontSize: '16px',
              width: '70%',
              marginRight: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
          <button
            onClick={handleAddTodo}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Add Todo
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3>Todos ({todos.length})</h3>
          {todos.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No todos yet. Add one above!</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {todos.map((todo) => (
                <li
                  key={todo._id}
                  style={{
                    padding: '10px',
                    margin: '5px 0',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => handleToggleTodo(todo)}
                    style={{ transform: 'scale(1.2)' }}
                  />
                  <span
                    style={{
                      flex: 1,
                      textDecoration: todo.completed ? 'line-through' : 'none',
                      color: todo.completed ? '#666' : '#333'
                    }}
                  >
                    {todo.text}
                  </span>
                  <button
                    onClick={() => handleDeleteTodo(todo)}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
          <h4>Debug Info</h4>
          <p><strong>Database:</strong> {database ? 'Connected' : 'Not connected'}</p>
          <p><strong>Server URL:</strong> {config.getServerUrl()}</p>
          <p><strong>Total Documents:</strong> {allDocs.docs.length}</p>
          <p><strong>Todo Count:</strong> {todos.length}</p>
        </div>
      </div>
    </>
  )
}

export default App
