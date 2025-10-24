// IndexedDB key export/import functions

export interface KeyExportData {
  timestamp: number;
  dbName: string;
  data: Record<string, any[]>;
  version: number;
  hasData: boolean;
}

export const exportKeysFromIndexedDB = async (): Promise<KeyExportData> => {
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

export const importKeysToIndexedDB = async (keyData: any): Promise<{ success: boolean, importedCount: number }> => {
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
