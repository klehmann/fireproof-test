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

  // Type definitions for key export/import
  interface KeyExportData {
    timestamp: number;
    dbName: string;
    data: Record<string, any[]>;
    version: number;
    hasData: boolean;
  }

  // Encryption utilities for secure key export/import
  const deriveKeyFromSecret = async (secret: string): Promise<CryptoKey> => {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('fireproof-keybag-salt'), // Fixed salt for consistency
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  };

  const encryptKeyData = async (keyData: any, secret: string): Promise<string> => {
    const key = await deriveKeyFromSecret(secret);
    const encoder = new TextEncoder();
    const jsonString = JSON.stringify(keyData);
    const data = encoder.encode(jsonString);
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);
    
    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  };

  const decryptKeyData = async (encryptedBase64: string, secret: string): Promise<any> => {
    const key = await deriveKeyFromSecret(secret);
    
    // Decode base64
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);
    
    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encryptedData
    );
    
    // Convert back to JSON
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedData);
    return JSON.parse(jsonString);
  };

  const createSecureKeyWrapper = (keyData: any): any => {
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      type: 'fireproof-keybag-export',
      data: keyData,
      checksum: btoa(JSON.stringify(keyData)).slice(0, 16) // Simple checksum for validation
    };
  };

  const validateSecureKeyWrapper = (wrapper: any): boolean => {
    if (!wrapper || typeof wrapper !== 'object') return false;
    if (wrapper.version !== '1.0') return false;
    if (wrapper.type !== 'fireproof-keybag-export') return false;
    if (!wrapper.timestamp || !wrapper.data) return false;
    
    // Validate timestamp format
    try {
      new Date(wrapper.timestamp);
    } catch {
      return false;
    }
    
    // Validate checksum
    const expectedChecksum = btoa(JSON.stringify(wrapper.data)).slice(0, 16);
    return wrapper.checksum === expectedChecksum;
  };

  // IndexedDB key export/import functions
  const exportKeysFromIndexedDB = async (): Promise<KeyExportData> => {
    try {
      console.log('🔑 Starting IndexedDB key export...');
      
      // Try multiple possible Fireproof IndexedDB database names
      const possibleDbNames = [
        'fp-keybag',
        //'fireproof-keybag',
        //'fireproof-keybag-default',
        //'fireproof-keybag-shared',
        //'fireproof-keybag-fireproof-todo-app'

      ];
      
      for (const dbName of possibleDbNames) {
        try {
          console.log(`🔑 Trying to open database: ${dbName}`);
          const request = indexedDB.open(dbName);
          
          const result = await new Promise<KeyExportData | null>((resolve, _reject) => {
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

  const importKeysToIndexedDB = async (keyData: any) : Promise<{ success: boolean, importedCount: number }> => {
    try {
      console.log('🔑 Starting IndexedDB key import...', keyData);
      
      if (!keyData.hasData) {
        console.log('🔑 No data to import');
        return { success: true, importedCount: 0 };
      }
      
      const dbName = keyData.dbName || 'fp-keybag';
      const request = indexedDB.open(dbName);
      
      return new Promise((resolve, _reject) => {
        request.onerror = () => {
          console.error('🔑 Failed to open IndexedDB for import:', request.error);
          resolve({ success: false, importedCount: 0 });
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
        // Prompt user for encryption secret
        const secret = prompt(
          'Enter a secret word to encrypt your keys:\n\n' +
          '(This secret will be needed to decrypt the keys in another browser)\n\n' +
          'Secret:'
        );
        
        if (!secret) {
          console.log('🔑 Export cancelled by user');
          return;
        }
        
        if (secret.length < 4) {
          alert('Secret must be at least 4 characters long.');
          return;
        }
        
        try {
          console.log('🔑 Creating secure wrapper...');
          const secureWrapper = createSecureKeyWrapper(keyExportData);
          console.log('🔑 Secure wrapper created:', secureWrapper);
          
          console.log('🔑 Encrypting keys...');
          const encryptedBase64 = await encryptKeyData(secureWrapper, secret);
          console.log('🔑 Keys encrypted successfully');
          
          // Show the encrypted base64 string to the user for copying
          const userConfirmed = confirm(
            `Keys exported and encrypted successfully!\n\n` +
            `Copy this encrypted base64 string to share with another browser:\n\n` +
            `${encryptedBase64}\n\n` +
            `Click OK to copy to clipboard, or Cancel to just see it.\n\n` +
            `Remember: You'll need the secret word "${secret}" to decrypt these keys.`
          );
          
          if (userConfirmed) {
            try {
              await navigator.clipboard.writeText(encryptedBase64);
              alert('Encrypted keys copied to clipboard! Paste them in the other browser along with the secret word.');
            } catch (error) {
              console.error('Failed to copy to clipboard:', error);
              alert('Failed to copy to clipboard. Please copy manually:\n\n' + encryptedBase64);
            }
          } else {
            alert('Keys exported and encrypted. Copy this base64 string:\n\n' + encryptedBase64 + '\n\nRemember the secret word: "' + secret + '"');
          }
        } catch (encryptionError) {
          console.error('🔑 Error encrypting keys:', encryptionError);
          alert('Failed to encrypt keys: ' + (encryptionError as Error).message);
        }
      } else {
        alert('No keys found to export. Try adding a todo item first to generate keys.');
      }
    } catch (error) {
      console.error('Error exporting keys:', error);
      alert('Failed to export keys: ' + (error as Error).message);
    }
  };

  const importKeys = async () => {
    try {
      // Prompt user to paste the encrypted base64 string
      const encryptedBase64 = prompt(
        'Paste the encrypted base64-encoded keys from the other browser:\n\n' +
        '(This should be a long encrypted string)\n\n' +
        'Encrypted keys:'
      );
      
      if (!encryptedBase64) {
        console.log('🔑 Import cancelled by user');
        return;
      }
      
      console.log('🔑 Received encrypted base64 string:', encryptedBase64.substring(0, 50) + '...');
      
      // Prompt user for the secret word
      const secret = prompt(
        'Enter the secret word used to encrypt these keys:\n\n' +
        '(This must match the secret used when exporting the keys)\n\n' +
        'Secret:'
      );
      
      if (!secret) {
        console.log('🔑 Import cancelled by user (no secret)');
        return;
      }
      
      try {
        console.log('🔑 Decrypting keys...');
        const decryptedWrapper = await decryptKeyData(encryptedBase64, secret);
        console.log('🔑 Decrypted wrapper:', decryptedWrapper);
        
        // Validate the decrypted wrapper
        if (!validateSecureKeyWrapper(decryptedWrapper)) {
          throw new Error('Invalid or corrupted key data. The secret may be incorrect or the data may be damaged.');
        }
        
        console.log('🔑 Wrapper validation passed');
        console.log('🔑 Key export timestamp:', decryptedWrapper.timestamp);
        
        // Extract the actual key data
        const keyData = decryptedWrapper.data;
        console.log('🔑 Extracted key data:', keyData);
        
        // Import keys into IndexedDB
        console.log('🔑 Importing keys into IndexedDB...');
        const importResult = await importKeysToIndexedDB(keyData);
        console.log('🔑 Import result:', importResult);
        
        if (importResult.success) {
          const exportDate = new Date(decryptedWrapper.timestamp).toLocaleString();
          alert(
            `Keys imported successfully!\n\n` +
            `Imported ${importResult.importedCount} keys.\n` +
            `Original export date: ${exportDate}\n\n` +
            `Reload the page to use the shared data.`
          );
          window.location.reload();
        } else {
          throw new Error('Failed to import keys into IndexedDB');
        }
      } catch (decryptError) {
        console.error('🔑 Error decrypting/importing keys:', decryptError);
        if ((decryptError as Error).message.includes('Invalid or corrupted')) {
          alert('Failed to decrypt keys. Please check:\n\n1. The secret word is correct\n2. The encrypted data was copied completely\n3. The data hasn\'t been modified');
        } else {
          alert('Failed to decrypt or import keys. Please check that you copied the complete encrypted string and entered the correct secret word.');
        }
      }
    } catch (error) {
      console.error('Error importing keys:', error);
      alert('Failed to import keys: ' + (error as Error).message);
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
