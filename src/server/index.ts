import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import * as fs from 'node:fs';
import * as path from 'node:path';

const PORT = parseInt(process.env.FIREPROOF_SERVER_PORT || process.env.PORT || '3001');
const HOST = process.env.FIREPROOF_SERVER_HOST || 'localhost';

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory storage for development (replace with actual storage solution)
const carFiles = new Map<string, Uint8Array>();
const metaStore = new Map<string, { data: string; parents: string[] }>();

// Clear existing data to prevent CBOR compatibility issues
console.log('🧹 Clearing existing data to prevent CBOR compatibility issues...');
carFiles.clear();
metaStore.clear();

async function main() {
  const app = new Hono();
  
  // Add CORS middleware
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }));

  // Fireproof protocol endpoint - handles metadata operations
  app.all('/fp', async (c) => {
    const url = new URL(c.req.url);
    const car = url.searchParams.get('car');
    const meta = url.searchParams.get('meta');
    
    console.log(`🔍 Handling ${c.req.method} request - car: ${car}, meta: ${meta}`);

    try {
      if (c.req.method === 'PUT') {
        console.log(`📤 PUT request received`);
        if (car) {
          // Handle CAR file upload
          console.log(`📦 Processing CAR file upload: ${car}`);
          const carArrayBuffer = await c.req.arrayBuffer();
          carFiles.set(car, new Uint8Array(carArrayBuffer));
          console.log(`📦 Stored CAR file: ${car}`);
          return c.json({ ok: true });
        } else if (meta) {
          // Handle metadata upload
          console.log(`📝 Processing metadata upload: ${meta}`);
          const body = await c.req.json();
          
          let entries: Array<{ data: string; cid: string; parents: string[] }>;
          
          // Handle both single entry and array of entries
          if (Array.isArray(body)) {
            entries = body;
          } else {
            entries = [body];
          }
          
          console.log('entries:', entries.map(entry => ({
            cid: entry.cid,
            parents: entry.parents,
            dataLength: entry.data?.length || 0,
            dataPreview: entry.data?.substring(0, 50) + (entry.data?.length > 50 ? '...' : ''),
          })));
          
          // Process each entry
          for (const entry of entries) {
            const { data, cid, parents } = entry;
            
            // Process data to prevent CBOR decode issues
            let processedData = data;
            if (data && typeof data === 'string') {
              try {
                // Try to parse as JSON to validate structure
                const parsed = JSON.parse(data);
                console.log('📝 Data is valid JSON, processing...');
                
                // Convert large numbers to strings recursively
                const processValue = (value: any): any => {
                  if (typeof value === 'number' && value > 999999999) {
                    console.log(`🔄 Converting large number ${value} to string`);
                    return value.toString();
                  } else if (Array.isArray(value)) {
                    return value.map(processValue);
                  } else if (value && typeof value === 'object') {
                    const processed: any = {};
                    for (const [key, val] of Object.entries(value)) {
                      processed[key] = processValue(val);
                    }
                    return processed;
                  }
                  return value;
                };
                
                const processed = processValue(parsed);
                processedData = JSON.stringify(processed);
              } catch (e) {
                console.log('📝 Data is not JSON, treating as string');
                // For non-JSON data, just replace large integers
                processedData = data.replace(/\b\d{10,}\b/g, (match) => {
                  console.log(`🔄 Converting large integer ${match} to string`);
                  return `"${match}"`;
                });
              }
            }
            
            metaStore.set(`${meta}/${cid}`, { data: processedData, parents });
            console.log(`📝 Stored metadata: ${meta}/${cid}`);
          }
          
          return c.json({ ok: true });
        }
      } else if (c.req.method === 'GET') {
        console.log(`📥 GET request received`);
        if (car) {
          // Handle CAR file retrieval
          console.log(`📦 Processing CAR file retrieval: ${car}`);
          const carArrayBuffer = carFiles.get(car);
          if (!carArrayBuffer) {
            console.log(`❌ CAR file not found: ${car}`);
            return c.json({ error: 'CAR file not found' }, 404);
          }
          console.log(`📦 Retrieved CAR file: ${car}`);
          return new Response(carArrayBuffer, {
            headers: {
              'Content-Type': 'application/octet-stream',
            },
          });
        } else if (meta) {
          // Handle metadata retrieval
          console.log(`📝 Processing metadata retrieval: ${meta}`);
          const allParents: string[] = [];
          const entries: Array<{ cid: string; data: string; parents?: string[] }> = [];

          // Get all entries for this meta database
          for (const [key, value] of metaStore.entries()) {
            if (key.startsWith(`${meta}/`)) {
              const cid = key.split('/')[1];
              const { data, parents } = value;
              
              if (parents) {
                for (const p of parents) {
                  allParents.push(p.toString());
                  console.log(`🗑️ Deleting parent in meta store: ${p}`);
                  metaStore.delete(`${meta}/${p}`);
                }
              }
              
              entries.push({ cid, data, parents });
            }
          }

          // Filter out entries that are parents (deleted) or have null data
          const filteredEntries = entries.filter(
            (entry) => entry.data !== null && !allParents.includes(entry.cid)
          );

          console.log(`📝 Retrieved ${filteredEntries.length} metadata entries for: ${meta}`);
          
          return c.json(filteredEntries);
        }
      } else if (c.req.method === 'DELETE') {
        console.log(`🗑️ DELETE request received`);
        if (car) {
          // Handle CAR file deletion
          console.log(`📦 Processing CAR file deletion: ${car}`);
          carFiles.delete(car);
          console.log(`🗑️ Deleted CAR file: ${car}`);
          return c.json({ ok: true });
        } else if (meta) {
          // Handle metadata deletion
          console.log(`📝 Processing metadata deletion: ${meta}`);
          const keysToDelete: string[] = [];
          for (const key of metaStore.keys()) {
            if (key.startsWith(`${meta}/`)) {
              keysToDelete.push(key);
            }
          }
          keysToDelete.forEach(key => metaStore.delete(key));
          console.log(`🗑️ Deleted ${keysToDelete.length} metadata entries for: ${meta}`);
          return c.json({ ok: true });
        } else {
          // Handle global metadata deletion
          console.log(`📝 Processing global metadata deletion`);
          const keysToDelete: string[] = [];
          for (const key of metaStore.keys()) {
            if (key.startsWith('main/')) {
              keysToDelete.push(key);
            }
          }
          keysToDelete.forEach(key => metaStore.delete(key));
          console.log(`🗑️ Deleted ${keysToDelete.length} global metadata entries`);
          return c.json({ ok: true });
        }
      }

      console.log(`❌ Invalid request - method: ${c.req.method}, car: ${car}, meta: ${meta}`);
      return c.json({ error: 'Invalid path' }, 400);
    } catch (error) {
      console.error('❌ Fireproof handler error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Add health check endpoint
  app.get('/health', (c) => {
    return c.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      fireproof: 'ready'
    });
  });

  // Add file storage endpoints for CID files (alternative to /fp?car=...)
  app.put('/files/*', async (c) => {
    const filePath = c.req.path.replace('/files/', '');
    const fullPath = path.join(DATA_DIR, 'files', filePath);
    
    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    
    // Write file
    const body = await c.req.arrayBuffer();
    await fs.promises.writeFile(fullPath, Buffer.from(body));
    
    return c.json({ ok: true, path: filePath });
  });

  app.get('/files/*', async (c) => {
    const filePath = c.req.path.replace('/files/', '');
    const fullPath = path.join(DATA_DIR, 'files', filePath);
    
    try {
      const fileBuffer = await fs.promises.readFile(fullPath);
      return new Response(fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });
    } catch (error) {
      return c.json({ error: 'File not found' }, 404);
    }
  });

  app.delete('/files/*', async (c) => {
    const filePath = c.req.path.replace('/files/', '');
    const fullPath = path.join(DATA_DIR, 'files', filePath);
    
    try {
      await fs.promises.unlink(fullPath);
      return c.json({ ok: true });
    } catch (error) {
      return c.json({ error: 'File not found' }, 404);
    }
  });

  // Start the server
  serve({
    fetch: app.fetch,
    port: PORT,
  });

  console.log(`🚀 Fireproof server running on http://${HOST}:${PORT}`);
  console.log(`📡 Fireproof API available at http://${HOST}:${PORT}/fp`);
  console.log(`📁 File storage available at http://${HOST}:${PORT}/files/`);
  console.log(`💚 Health check available at http://${HOST}:${PORT}/health`);
}

main().catch((err) => {
  console.error('❌ Server startup error:', err);
  process.exit(1);
});
