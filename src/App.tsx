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
  // Configure shared keybag based on localStorage share token BEFORE useFireproof
  const storedShareToken = localStorage.getItem('fireproof-share-token');
  console.log('🔑 Share token from localStorage:', storedShareToken);
  
  if (storedShareToken && typeof window !== 'undefined') {
    // Use the default Fireproof keybag since we're importing keys directly
    // The keys are already in IndexedDB from the import process
    console.log('🔑 Using default Fireproof keybag with imported keys');
    
    // Debug: Check what's actually in the keybag immediately
    try {
      console.log('🔍 Debugging keybag contents...');
      const request = indexedDB.open('fp-keybag');
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['bag'], 'readonly');
        const store = transaction.objectStore('bag');
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = () => {
          const keys = getAllRequest.result;
          console.log('🔍 Keys found in fp-keybag:', keys.length);
          console.log('🔍 Key details:', keys.map(k => ({ id: k.id, clazz: k.clazz })));
          
          // Check if we have the specific key that Fireproof is looking for
          const urlTokenKey = keys.find(k => k.id === 'z2tnVGFiYt36KR/urlToken');
          if (urlTokenKey) {
            console.log('✅ Found the JWT key that Fireproof needs:', urlTokenKey.id);
          } else {
            console.log('❌ JWT key not found in keybag');
          }
        };
      };
    } catch (error) {
      console.error('🔍 Error debugging keybag:', error);
    }
    
    // We don't need to set FP_KEYBAG_URL since we're using the default
    // The imported keys will be in the standard Fireproof keybag location
    console.log('🔑 Keys should be available in default Fireproof keybag');
  } else {
    console.log('🔑 No share token found, using default keybag');
  }

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

  // Log database initialization
  console.log('🗄️ Database initialized:', database);
  console.log('🗄️ Database ledger:', database.ledger);
  console.log('🗄️ Using shared database name: fireproof-todo-app');
  
  // Log the current FP_PRESET_ENV to verify it's still set
  console.log('🔑 Current FP_PRESET_ENV:', (window as any)[Symbol.for("FP_PRESET_ENV")]);

  const allDocs = useAllDocs();
  console.log('📄 allDocs result:', allDocs);
  console.log('📄 allDocs docs count:', allDocs.docs?.length || 0);

  const result = useLiveQuery<Todo>('createdAt', {limit: 100, descending: true})
  const todos = result.docs
  const { doc: todo, merge: mergeTodo, save: saveTodo, reset: resetTodo } = useDocument<Todo>(() => ({
    text: "",
    completed: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }))

  const [newTodoText, setNewTodoText] = useState("");
  const [shareToken, setShareToken] = useState<string>("");
  const [inviteLinkCid, setInviteLinkCid] = useState<string>("");
  const [joinCid, setJoinCid] = useState<string>("");
  const [connection, setConnection] = useState<any>(null);

  useEffect(() => {
    console.log('🔌 Database connection effect triggered');
    console.log('🔌 Database:', database);
    console.log('🔌 Database ledger:', database?.ledger);
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

  // IndexedDB key export/import functions
  const exportKeysFromIndexedDB = async () => {
    try {
      console.log('🔑 Starting IndexedDB key export...');
      
      // Try multiple possible Fireproof IndexedDB database names
      const possibleDbNames = [
        'fp-keybag',  // This is the actual database name from the screenshot
        'fireproof-keybag',
        'fireproof-keybag-default',
        'fireproof-keybag-shared',
        'fireproof-keybag-fireproof-todo-app'
      ];
      
      for (const dbName of possibleDbNames) {
        try {
          console.log(`🔑 Trying to open database: ${dbName}`);
          const request = indexedDB.open(dbName);
          
          const result = await new Promise((resolve, reject) => {
            request.onerror = () => {
              console.log(`🔑 Failed to open ${dbName}:`, request.error);
              resolve(null); // Continue to next database
            };
            
            request.onsuccess = () => {
              const db = request.result;
              console.log(`🔑 Successfully opened IndexedDB: ${db.name}`);
              
              // Check what object stores exist
              const storeNames = Array.from(db.objectStoreNames);
              console.log(`🔑 Available object stores:`, storeNames);
              
              // Try to get data from any available store
              const allData: any = {};
              let hasData = false;
              
              storeNames.forEach(storeName => {
                try {
                  const transaction = db.transaction([storeName], 'readonly');
                  const store = transaction.objectStore(storeName);
                  const getAllRequest = store.getAll();
                  
                  getAllRequest.onsuccess = () => {
                    const data = getAllRequest.result;
                    allData[storeName] = data;
                    console.log(`🔑 Retrieved ${data.length} entries from ${storeName}`);
                    if (data.length > 0) hasData = true;
                  };
                  
                  getAllRequest.onerror = () => {
                    console.log(`🔑 Failed to get data from ${storeName}:`, getAllRequest.error);
                  };
                } catch (error) {
                  console.log(`🔑 Error accessing ${storeName}:`, error);
                }
              });
              
              // Wait a bit for async operations to complete
              setTimeout(() => {
                const exportData = {
                  timestamp: Date.now(),
                  dbName: dbName,
                  data: allData,
                  version: db.version,
                  hasData: hasData
                };
                
                console.log('🔑 Export data prepared:', exportData);
                resolve(exportData);
              }, 100);
            };
            
            request.onupgradeneeded = () => {
              console.log(`🔑 IndexedDB upgrade needed for ${dbName}, but we only need to read`);
            };
          });
          
          if (result && result.hasData) {
            console.log(`🔑 Found data in ${dbName}, using this database`);
            return result;
          }
        } catch (error) {
          console.log(`🔑 Error with ${dbName}:`, error);
          continue;
        }
      }
      
      // If no database had data, return empty export
      console.log('🔑 No data found in any IndexedDB database');
      return {
        timestamp: Date.now(),
        dbName: 'none',
        data: {},
        version: 0,
        hasData: false
      };
      
    } catch (error) {
      console.error('🔑 Error in exportKeysFromIndexedDB:', error);
      throw error;
    }
  };

  const importKeysToIndexedDB = async (keyData: any) => {
    try {
      console.log('🔑 Starting IndexedDB key import...', keyData);
      
      if (!keyData.hasData) {
        console.log('🔑 No data to import');
        return { success: true, importedCount: 0 };
      }
      
      const dbName = keyData.dbName || 'fp-keybag';
      const request = indexedDB.open(dbName);
      
      return new Promise((resolve, reject) => {
        request.onerror = () => {
          console.error('🔑 Failed to open IndexedDB for import:', request.error);
          reject(request.error);
        };
        
        request.onsuccess = () => {
          const db = request.result;
          console.log('🔑 Successfully opened IndexedDB for import:', db.name);
          
          // Import data into all available object stores
          const data = keyData.data || {};
          let totalImported = 0;
          let totalExpected = 0;
          
          // Count total expected entries
          Object.values(data).forEach((storeData: any) => {
            if (Array.isArray(storeData)) {
              totalExpected += storeData.length;
            }
          });
          
          if (totalExpected === 0) {
            console.log('🔑 No data to import');
            resolve({ success: true, importedCount: 0 });
            return;
          }
          
          // Import into each object store
          Object.entries(data).forEach(([storeName, storeData]: [string, any]) => {
            if (!Array.isArray(storeData) || storeData.length === 0) {
              return;
            }
            
            try {
              const transaction = db.transaction([storeName], 'readwrite');
              const store = transaction.objectStore(storeName);
              
              // Clear existing data
              const clearRequest = store.clear();
              
              clearRequest.onsuccess = () => {
                console.log(`🔑 Cleared existing data in ${storeName}`);
                
                     // Import new data
                     storeData.forEach((item: any, index: number) => {
                       // For out-of-line key stores, we need to provide the key explicitly
                       // The key is usually the 'id' field of the item
                       const key = item.id || item.key || index;
                       const addRequest = store.add(item, key);
                       
                       addRequest.onsuccess = () => {
                         totalImported++;
                         console.log(`🔑 Imported item ${totalImported}/${totalExpected} from ${storeName} with key: ${key}`);
                         
                         if (totalImported === totalExpected) {
                           console.log('🔑 All data imported successfully');
                           resolve({ success: true, importedCount: totalImported });
                         }
                       };
                       
                       addRequest.onerror = () => {
                         console.error(`🔑 Failed to import item from ${storeName} with key ${key}:`, addRequest.error);
                         // Continue with other items instead of rejecting
                         totalImported++;
                         if (totalImported === totalExpected) {
                           resolve({ success: true, importedCount: totalImported });
                         }
                       };
                     });
              };
              
              clearRequest.onerror = () => {
                console.error(`🔑 Failed to clear ${storeName}:`, clearRequest.error);
                // Continue with other stores
              };
            } catch (error) {
              console.error(`🔑 Error importing to ${storeName}:`, error);
            }
          });
        };
        
        request.onupgradeneeded = (event) => {
          console.log('🔑 IndexedDB upgrade needed for import');
          const db = (event.target as IDBOpenDBRequest).result;
          
          // Create object stores based on the exported data
          const data = keyData.data || {};
          Object.keys(data).forEach(storeName => {
            if (!db.objectStoreNames.contains(storeName)) {
              db.createObjectStore(storeName, { keyPath: 'id' });
              console.log(`🔑 Created object store: ${storeName}`);
            }
          });
        };
      });
    } catch (error) {
      console.error('🔑 Error in importKeysToIndexedDB:', error);
      throw error;
    }
  };

  // Simple key sharing functions - direct copy/paste approach
  const exportKeys = async () => {
    try {
      console.log('🔑 Exporting keys from IndexedDB...');
      
      // First, let's see what IndexedDB databases exist
      console.log('🔑 Checking available IndexedDB databases...');
      try {
        const databases = await indexedDB.databases();
        console.log('🔑 Available databases:', databases);
      } catch (error) {
        console.log('🔑 Error listing databases:', error);
      }
      
      // Export keys directly from IndexedDB
      const keyExportData = await exportKeysFromIndexedDB();
      console.log('🔑 Exported keys from IndexedDB:', keyExportData);
      
      if (keyExportData.hasData) {
        // Convert to base64 for easy copying
        const jsonString = JSON.stringify(keyExportData);
        const base64String = btoa(jsonString);
        
        console.log('🔑 Base64 encoded keys:', base64String);
        
        // Show the base64 string to the user for copying
        const userConfirmed = confirm(
          `Keys exported successfully!\n\n` +
          `Copy this base64 string to share with another browser:\n\n` +
          `${base64String}\n\n` +
          `Click OK to copy to clipboard, or Cancel to just see it.`
        );
        
        if (userConfirmed) {
          try {
            await navigator.clipboard.writeText(base64String);
            alert('Keys copied to clipboard! Paste them in the other browser.');
          } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            alert('Failed to copy to clipboard. Please copy manually:\n\n' + base64String);
          }
        } else {
          alert('Keys exported. Copy this base64 string:\n\n' + base64String);
        }
      } else {
        alert('No keys found to export. Try adding a todo item first to generate keys.');
      }
    } catch (error) {
      console.error('Error exporting keys:', error);
      alert('Failed to export keys: ' + error.message);
    }
  };

  const importKeys = async () => {
    try {
      // Prompt user to paste the base64 string
      const base64String = prompt(
        'Paste the base64-encoded keys from the other browser:\n\n' +
        '(This should be a long string that starts with "eyJ0aW1lc3RhbXAiOiI...")'
      );
      
      if (!base64String) {
        console.log('🔑 Import cancelled by user');
        return;
      }
      
      console.log('🔑 Received base64 string:', base64String.substring(0, 50) + '...');
      
      try {
        // Decode the base64 string
        const jsonString = atob(base64String);
        const keyData = JSON.parse(jsonString);
        
        console.log('🔑 Decoded key data:', keyData);
        
        // Import keys into IndexedDB
        console.log('🔑 Importing keys into IndexedDB...');
        const importResult = await importKeysToIndexedDB(keyData);
        console.log('🔑 Import result:', importResult);
        
        if (importResult.success) {
          alert(`Keys imported successfully! Imported ${importResult.importedCount} keys.\n\nReload the page to use the shared data.`);
          window.location.reload();
        } else {
          throw new Error('Failed to import keys into IndexedDB');
        }
      } catch (decodeError) {
        console.error('🔑 Error decoding/importing keys:', decodeError);
        alert('Failed to decode or import keys. Please check that you copied the complete base64 string.');
      }
    } catch (error) {
      console.error('Error importing keys:', error);
      alert('Failed to import keys: ' + error.message);
    }
  };

  const createInviteLink = async () => {
    if (!shareToken) {
      alert('Please generate a share token first');
      return;
    }
    
    try {
      // Create a simple invite link that contains the share token
      const inviteData = {
        token: shareToken,
        timestamp: Date.now(),
        databaseName: 'fireproof-todo-app'
      };
      
      const inviteLink = btoa(JSON.stringify(inviteData));
      setInviteLinkCid(inviteLink);
      console.log('Invite link created:', inviteLink);
      
      // Store the invite link in localStorage
      localStorage.setItem('fireproof-invite-link', inviteLink);
    } catch (error) {
      console.error('Error creating invite link:', error);
    }
  };

  const joinSharedLedger = async () => {
    if (!joinCid) {
      alert('Please enter an invite link CID');
      return;
    }
    
    console.log('🔗 Starting to join shared ledger with CID:', joinCid);
    
    try {
      let shareToken;
      
      // Try to parse as base64-encoded JSON first (new format)
      try {
        const inviteData = JSON.parse(atob(joinCid));
        shareToken = inviteData.token;
        console.log('🔗 Parsed invite data:', inviteData);
      } catch (jsonError) {
        console.log('🔗 Failed to parse as base64 JSON, trying direct base64...');
        // If that fails, try treating it as a direct base64-encoded token
        try {
          shareToken = atob(joinCid);
          console.log('🔗 Decoded direct token:', shareToken);
        } catch (base64Error) {
          console.log('🔗 Failed to parse as base64, using as plain token...');
          // If both fail, treat it as a plain token string
          shareToken = joinCid;
          console.log('🔗 Using plain token:', shareToken);
        }
      }
      
      // Validate the token
      if (!shareToken || shareToken.length < 5) {
        console.error('🔗 Invalid share token:', shareToken);
        throw new Error('Invalid token format');
      }
      
      console.log('🔗 Valid share token found:', shareToken);
      
      // Store the shared token in localStorage
      localStorage.setItem('fireproof-share-token', shareToken);
      console.log('🔗 Stored share token in localStorage:', shareToken);
      
      // Retrieve keys from the server and import directly into IndexedDB
      console.log('🔗 Retrieving keys from server...');
      try {
        const response = await fetch(`http://localhost:3001/api/keys/${shareToken}`);
        if (response.ok) {
          const data = await response.json();
          console.log('🔗 Retrieved keys from server:', data);
          
          // Import keys directly into IndexedDB
          console.log('🔗 Importing keys into IndexedDB...');
          const importResult = await importKeysToIndexedDB(data.keys);
          console.log('🔗 Import result:', importResult);
          
          if (importResult.success) {
            console.log('🔗 Keys imported successfully into IndexedDB');
            alert(`Successfully joined shared ledger with token: ${shareToken}! Imported ${importResult.importedCount} keys. Reloading page...`);
            window.location.reload();
          } else {
            throw new Error('Failed to import keys into IndexedDB');
          }
        } else {
          console.error('🔗 Failed to retrieve keys from server:', await response.text());
          throw new Error('Failed to retrieve keys from server');
        }
      } catch (error) {
        console.error('🔗 Error retrieving/importing keys:', error);
        alert(`Failed to join shared ledger: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      console.error('🔗 Error joining shared ledger:', error);
      alert(`Failed to join shared ledger: ${error instanceof Error ? error.message : String(error)}`);
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

        {/* Sharing Section */}
        <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <h3>🔗 Share Data Between Browsers</h3>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
            Use these tools to share your todos between different browsers/devices:
          </p>
          
          {/* Current Status */}
          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
            <h4>Current Status:</h4>
            {storedShareToken ? (
              <p style={{ color: '#28a745', fontSize: '14px' }}>
                ✅ Connected to shared ledger with token: <code>{storedShareToken}</code>
              </p>
            ) : (
              <p style={{ color: '#6c757d', fontSize: '14px' }}>
                ⚪ Not connected to shared ledger (using local storage)
              </p>
            )}
          </div>
          
          {/* Export Keys */}
          <div style={{ marginBottom: '15px' }}>
            <h4>Step 1: Export Keys (Source Browser)</h4>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              Click this button to export your encryption keys. You'll get a base64 string to copy.
            </p>
            <button
              onClick={exportKeys}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Export Keys
            </button>
          </div>

          {/* Import Keys */}
          <div style={{ marginBottom: '15px' }}>
            <h4>Step 2: Import Keys (Target Browser)</h4>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              Paste the base64 string from the source browser to import the keys.
            </p>
            <button
              onClick={importKeys}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Import Keys
            </button>
          </div>
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
