import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { Context } from 'hono';
import { SuperThis } from '@fireproof/core-types-base';
import { ensureLogger, ensureSuperThis } from '@fireproof/core-runtime';
import { jsonEnDe } from '@fireproof/core-protocols-cloud';
import { 
  Gestalt, 
  MsgBase,
  MsgWithConn,
  MsgIsWithConn,
  QSId,
  qsidKey,
  FPCloudClaim
} from '@fireproof/core-types-protocols-cloud';
import { HttpHeader } from '@adviser/cement';
import { exception2Result, top_uint8 } from '@adviser/cement';
import { SignJWT } from 'jose';
import { generateKeyPair } from 'jose/key/generate/keypair';

// Simple in-memory storage for demo purposes
const carFiles = new Map<string, Uint8Array>();
const metaStore = new Map<string, { data: string; parents?: string[] }>();

// Simple WebSocket room implementation
class SimpleWSRoom {
  readonly sthis: SuperThis;
  readonly id: string;
  private _conns = new Map<string, any>();

  constructor(sthis: SuperThis) {
    this.sthis = sthis;
    this.id = sthis.nextId(12).str;
  }

  getConns(): any[] {
    return Array.from(this._conns.values());
  }

  removeConn(...conns: QSId[]): void {
    for (const conn of conns.flat()) {
      this._conns.delete(qsidKey(conn));
    }
  }

  addConn(ws: any, conn: QSId): QSId {
    const key = qsidKey(conn);
    this._conns.set(key, { ws, conn });
    return conn;
  }

  isConnected(msg: MsgBase): msg is MsgWithConn<MsgBase> {
    if (!MsgIsWithConn(msg)) {
      return false;
    }
    return this._conns.has(qsidKey(msg.conn));
  }
}

// Simple message dispatcher for Fireproof protocol
class SimpleMsgDispatcher {
  private wsRoom: SimpleWSRoom;
  private logger: any;
  private ende: any;
  private sthis: SuperThis;

  constructor(wsRoom: SimpleWSRoom, logger: any, ende: any, sthis: SuperThis) {
    this.wsRoom = wsRoom;
    this.logger = logger;
    this.ende = ende;
    this.sthis = sthis;
  }

  async dispatch(ctx: any, msg: MsgBase): Promise<Response> {
    try {
      this.logger.Info().Any('msg', msg).Msg('Dispatching message');

      // Handle different message types
      switch (msg.type) {
        case 'reqGestalt':
          return this.handleGestalt(ctx, msg);
        case 'reqOpen':
          return this.handleOpen(ctx, msg);
        case 'reqPutMeta':
          return this.handlePutMeta(ctx, msg);
        case 'reqGetMeta':
          return this.handleGetMeta(ctx, msg);
        case 'reqDelMeta':
          return this.handleDelMeta(ctx, msg);
        case 'reqPutData':
          return this.handlePutData(ctx, msg);
        case 'reqGetData':
          return this.handleGetData(ctx, msg);
        case 'reqDelData':
          return this.handleDelData(ctx, msg);
        case 'bindGetMeta':
          // Handle streaming metadata requests
          return this.handleBindGetMeta(ctx, msg);
        default:
          this.logger.Warn().Str('type', msg.type).Msg('Unknown message type');
          return new Response(JSON.stringify({ error: 'Unknown message type' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
      }
    } catch (error) {
      this.logger.Error().Err(error).Msg('Error dispatching message');
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private handleGestalt(_ctx: any, msg: any): Response {
    const gestalt: Gestalt = {
      storeTypes: ['meta', 'file', 'car', 'wal'],
      id: 'fireproof-test-server',
      protocolCapabilities: ['reqRes'], // Remove 'stream' to disable WebSocket
      httpEndpoints: ['/fp'],
      wsEndpoints: [], // Remove WebSocket endpoint
      encodings: ['JSON'],
      auth: [],
      requiresAuth: false,
      data: { inband: true, outband: true },
      meta: { inband: true, outband: true },
      wal: { inband: true, outband: true },
      reqTypes: ['reqGestalt', 'reqOpen', 'reqPutMeta', 'reqGetMeta', 'reqDelMeta', 'reqPutData', 'reqGetData', 'reqDelData', 'bindGetMeta'],
      resTypes: ['resGestalt', 'resOpen', 'resPutMeta', 'resGetMeta', 'resDelMeta', 'resPutData', 'resGetData', 'resDelData'],
      eventTypes: ['updateMeta']
    };

    const response = {
      type: 'resGestalt',
      tid: msg.tid,
      gestalt
    };
    
    this.logger.Info().Any('gestaltResponse', response).Msg('Sending gestalt response');
    
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private handleOpen(_ctx: any, msg: any): Response {
    this.logger.Info().Any('openMsg', msg).Msg('Handling reqOpen');
    
    // Generate a connection ID for this session
    const connId = {
      reqId: msg.conn?.reqId || this.sthis.nextId(12).str,
      resId: this.sthis.nextId(12).str
    };
    
    const response = {
      type: 'resOpen',
      tid: msg.tid,
      conn: connId,
      ok: true
    };
    
    this.logger.Info().Any('openResponse', response).Msg('Sending resOpen response');
    
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private handlePutMeta(_ctx: any, msg: any): Response {
    this.logger.Info().Any('putMetaMsg', msg).Msg('Handling reqPutMeta');
    
    const { meta } = msg;
    
    if (meta && meta.metas) {
      for (const metaEntry of meta.metas) {
        const key = `main/${metaEntry.cid}`;
        metaStore.set(key, {
          data: metaEntry.data,
          parents: metaEntry.parents
        });
        this.logger.Debug().Str('key', key).Msg('Stored metadata');
      }
    }

    const response = {
      type: 'resPutMeta',
      tid: msg.tid,
      ok: true
    };
    
    this.logger.Info().Any('putMetaResponse', response).Msg('Sending resPutMeta response');

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private handleGetMeta(_ctx: any, msg: any): Response {
    const entries: Array<{ cid: string; data: string; parents?: string[] }> = [];

    for (const [key, value] of metaStore.entries()) {
      if (key.startsWith('main/')) {
        const cid = key.split('/')[1];
        entries.push({
          cid,
          data: value.data,
          parents: value.parents
        });
      }
    }

    return new Response(JSON.stringify({
      type: 'resGetMeta',
      tid: msg.tid,
      meta: { metas: entries, keys: [] }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private handleDelMeta(_ctx: any, msg: any): Response {
    const { meta } = msg;
    
    if (meta && meta.metas) {
      for (const metaEntry of meta.metas) {
        const key = `main/${metaEntry.cid}`;
        metaStore.delete(key);
        this.logger.Debug().Str('key', key).Msg('Deleted metadata');
      }
    }

    return new Response(JSON.stringify({
      type: 'resDelMeta',
      tid: msg.tid,
      ok: true
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private handlePutData(_ctx: any, msg: any): Response {
    this.logger.Info().Any('putDataMsg', msg).Msg('Handling reqPutData');
    
    // Extract the key from the URL parameters to create a proper upload URL
    const key = msg.urlParam?.key || 'unknown';
    const signedUrl = `http://localhost:3001/upload/${key}`;
    
    const response = {
      type: 'resPutData',
      tid: msg.tid,
      signedUrl: signedUrl,
      ok: true
    };
    
    this.logger.Info().Any('putDataResponse', response).Msg('Sending resPutData response with signedUrl');
    
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private handleGetData(_ctx: any, msg: any): Response {
    // For now, return empty data
    return new Response(JSON.stringify({
      type: 'resGetData',
      tid: msg.tid,
      data: null
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private handleDelData(_ctx: any, msg: any): Response {
    return new Response(JSON.stringify({
      type: 'resDelData',
      tid: msg.tid,
      ok: true
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private handleBindGetMeta(_ctx: any, msg: any): Response {
    this.logger.Info().Any('bindGetMetaMsg', msg).Msg('Handling bindGetMeta');
    
    // For streaming metadata requests, we'll return the same data as regular getMeta
    const entries: Array<{ cid: string; data: string; parents?: string[] }> = [];

    for (const [key, value] of metaStore.entries()) {
      if (key.startsWith('main/')) {
        const cid = key.split('/')[1];
        entries.push({
          cid,
          data: value.data,
          parents: value.parents
        });
      }
    }

    return new Response(JSON.stringify({
      type: 'resGetMeta',
      tid: msg.tid,
      meta: { metas: entries, keys: [] }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export class FireproofBackend {
  private app: Hono;
  private wsRoom: SimpleWSRoom;
  private sthis: SuperThis;
  private logger: any;
  private ende: any;
  private msgDispatcher: SimpleMsgDispatcher;
  private privateKey!: CryptoKey;

  constructor() {
    this.app = new Hono();
    this.sthis = ensureSuperThis();
    this.logger = ensureLogger(this.sthis, 'FireproofBackend');
    this.ende = jsonEnDe(this.sthis);
    this.wsRoom = new SimpleWSRoom(this.sthis);
    this.msgDispatcher = new SimpleMsgDispatcher(this.wsRoom, this.logger, this.ende, this.sthis);
    
    this.setupRoutes();
  }

  async initialize() {
    // Initialize token service
    await this.initializeTokenService();
  }

  private async initializeTokenService() {
    try {
      // Generate a key pair for JWT signing
      const { privateKey } = await generateKeyPair('ES256', { extractable: true });
      this.privateKey = privateKey;
      
      this.logger.Debug().Msg('Token service initialized');
    } catch (error) {
      this.logger.Error().Err(error).Msg('Failed to initialize token service');
      throw error;
    }
  }

  private setupRoutes() {
    // CORS middleware - more permissive for development
    this.app.use('*', cors({
      origin: '*', // Allow all origins for development
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'User-Agent', 'Cache-Control', 'Pragma'],
      credentials: false, // Set to false when using wildcard origin
      exposeHeaders: ['Content-Length', 'Content-Type', 'Access-Control-Allow-Origin'],
      maxAge: 86400, // 24 hours
    }));

    // Fireproof protocol endpoint
    this.app.all('/fp', async (c: Context) => {
      // Handle CORS preflight requests
      if (c.req.method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400',
          }
        });
      }
      
      if (c.req.method === 'PUT') {
        try {
          const msg = await c.req.json() as MsgBase;
          this.logger.Info().Any('msg', msg).Msg('Received Fireproof message');
          
          const ctx = {
            sthis: this.sthis,
            logger: this.logger,
            ende: this.ende,
            wsRoom: this.wsRoom,
            req: {
              method: c.req.method,
              url: c.req.url,
              headers: HttpHeader.from(c.req.header()),
            }
          };

          const response = await this.msgDispatcher.dispatch(ctx, msg);
          this.logger.Info().Any('response', response).Msg('Sending Fireproof response');
          return response;
        } catch (error) {
          this.logger.Error().Err(error).Msg('Error handling Fireproof message');
          return c.json({ error: 'Internal server error' }, 500);
        }
      }
      
      // Handle other methods
      return c.json({ 
        status: 'method not allowed',
        method: c.req.method,
        allowed: ['PUT', 'OPTIONS']
      }, 405);
    });

    // Root URL endpoint for Fireproof protocol (with query parameters)
    this.app.all('/', async (c: Context) => {
      try {
        const url = new URL(c.req.url);
        const store = url.searchParams.get('store');
        const tenant = url.searchParams.get('tenant');
        const ledger = url.searchParams.get('ledger');
        const localName = url.searchParams.get('localName');
        const name = url.searchParams.get('name');
        const storekey = url.searchParams.get('storekey');
        
        this.logger.Info()
          .Str('method', c.req.method)
          .Str('store', store || 'none')
          .Str('tenant', tenant || 'none')
          .Str('ledger', ledger || 'none')
          .Str('localName', localName || 'none')
          .Str('name', name || 'none')
          .Str('storekey', storekey || 'none')
          .Msg('🔥 Root URL Fireproof request');
        
        // Handle GET requests (protocol check)
        if (c.req.method === 'GET') {
          this.logger.Info().Msg('✅ Protocol check - returning success');
          return c.json({ 
            status: 'ok',
            protocol: 'fireproof',
            version: 'v0.1-fp-cloud',
            endpoints: ['/fp'],
            capabilities: ['reqRes']
          });
        }
        
        // Handle PUT requests (actual Fireproof messages)
        if (c.req.method === 'PUT') {
          const msg = await c.req.json() as MsgBase;
          this.logger.Info().Any('rootMsg', msg).Msg('Received Fireproof message on root');
          
          const ctx = {
            sthis: this.sthis,
            logger: this.logger,
            ende: this.ende,
            wsRoom: this.wsRoom,
            req: {
              method: c.req.method,
              url: c.req.url,
              headers: HttpHeader.from(c.req.header()),
            }
          };

          const response = await this.msgDispatcher.dispatch(ctx, msg);
          this.logger.Info().Any('rootResponse', response).Msg('Sending Fireproof response from root');
          return response;
        }
        
        // Handle other methods
        return c.json({ 
          status: 'method not allowed',
          method: c.req.method,
          allowed: ['GET', 'PUT']
        }, 405);
      } catch (error) {
        this.logger.Error().Err(error).Msg('Error handling Fireproof message on root');
        return c.json({ error: 'Internal server error' }, 500);
      }
    });

    // WebSocket endpoint for real-time communication
    this.app.get('/ws', async (c: Context) => {
      try {
        const { upgradeWebSocket } = createNodeWebSocket({ app: this.app });
        
        return upgradeWebSocket((c: Context) => ({
          onOpen: (_evt: Event, ws: any) => {
            const connId: QSId = {
              reqId: this.sthis.nextId(12).str,
              resId: this.sthis.nextId(12).str
            };
            this.wsRoom.addConn(ws, connId);
            this.logger.Info().Str('connId', connId.reqId).Msg('WebSocket connection opened');
          },
          onMessage: async (evt: MessageEvent, ws: any) => {
            try {
              this.logger.Info().Str('data', evt.data.toString()).Msg('WebSocket message received');
              
              const msg = await exception2Result(async () => 
                this.ende.decode(await top_uint8(evt.data)) as MsgBase
              );
              
              if (msg.isErr()) {
                this.logger.Error().Err(msg.Err()).Msg('Failed to decode WebSocket message');
                ws.send(this.ende.encode({
                  type: 'error',
                  error: msg.Err().message
                }) as Uint8Array);
                return;
              }

              this.logger.Info().Any('decodedMsg', msg.Ok()).Msg('Decoded WebSocket message');

              const ctx = {
                sthis: this.sthis,
                logger: this.logger,
                ende: this.ende,
                wsRoom: this.wsRoom,
                ws,
                req: {
                  method: c.req.method,
                  url: c.req.url,
                  headers: HttpHeader.from(c.req.header()),
                }
              };

              const response = await this.msgDispatcher.dispatch(ctx, msg.Ok());
              
              // Send the response back through WebSocket
              if (response instanceof Response) {
                const responseText = await response.text();
                const responseObj = JSON.parse(responseText);
                this.logger.Info().Any('responseObj', responseObj).Msg('Sending WebSocket response');
                ws.send(this.ende.encode(responseObj) as Uint8Array);
              } else {
                this.logger.Info().Any('response', response).Msg('Sending WebSocket response');
                ws.send(this.ende.encode(response) as Uint8Array);
              }
            } catch (error) {
              this.logger.Error().Err(error).Msg('WebSocket message error');
            }
          },
          onClose: (_evt: CloseEvent, ws: any) => {
            // Find and remove the connection
            const conns = this.wsRoom.getConns();
            for (const conn of conns) {
              if (conn.ws === ws) {
                this.wsRoom.removeConn(conn.conn);
                this.logger.Info().Str('connId', conn.conn.reqId).Msg('WebSocket connection closed');
                break;
              }
            }
          },
          onError: (evt: Event, _ws: any) => {
            this.logger.Error().Any('error', evt).Msg('WebSocket error');
          }
        }))(c, async () => {});
      } catch (error) {
        this.logger.Error().Err(error).Msg('WebSocket upgrade error');
        return c.text('WebSocket upgrade failed', 500);
      }
    });

            // API endpoint for token management
            this.app.all('/api', async (c: Context) => {
              this.logger.Info().Str('method', c.req.method).Str('url', c.req.url).Msg('API endpoint called');
      
      if (c.req.method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400',
          }
        });
      }
      
              if (c.req.method === 'POST') {
                try {
                  const body = await c.req.json();
                  this.logger.Info().Any('body', body).Msg('Token request received');
          
          if (body.type === 'reqTokenByResultId') {
            try {
              // Generate a proper JWT token using SignJWT directly
              const token = await new SignJWT({
                userId: 'demo-user',
                email: 'demo@example.com',
                created: new Date(),
                tenants: [{ id: 'demo-tenant', role: 'admin' }],
                ledgers: [{ id: 'fireproof-todo-app', role: 'admin', right: 'write' }],
                selected: {
                  tenant: 'demo-tenant',
                  ledger: 'fireproof-todo-app'
                }
              } satisfies FPCloudClaim)
                .setProtectedHeader({ alg: 'ES256' })
                .setIssuedAt()
                .setIssuer('fireproof-demo')
                .setAudience('fireproof-client')
                .setExpirationTime('24h')
                .sign(this.privateKey);
              
              const claims: FPCloudClaim = {
                userId: 'demo-user',
                email: 'demo@example.com',
                created: new Date(),
                tenants: [{ id: 'demo-tenant', role: 'admin' }],
                ledgers: [{ id: 'fireproof-todo-app', role: 'admin', right: 'write' }],
                selected: {
                  tenant: 'demo-tenant',
                  ledger: 'fireproof-todo-app'
                }
              };
              
                      return c.json({
                        type: 'resTokenByResultId',
                        status: 'found',
                        resultId: body.resultId || 'unknown',
                        token: token
                      });
            } catch (error) {
              this.logger.Error().Err(error).Msg('Error generating token');
              return c.json({ error: 'Token generation failed' }, 500);
            }
          }
          
          return c.json({ 
            status: 'ok',
            message: 'API endpoint ready',
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          this.logger.Error().Err(error).Msg('Error processing token request');
          return c.json({ error: 'Invalid request' }, 400);
        }
      }
      
      return c.json({ 
        status: 'ok',
        message: 'API endpoint ready',
        timestamp: new Date().toISOString()
      });
    });

            // Dashboard API endpoint for token management
            this.app.all('/fp/cloud/api/token', async (c: Context) => {
              this.logger.Debug().Str('method', c.req.method).Msg('Dashboard API endpoint called');
              
              if (c.req.method === 'OPTIONS') {
                return new Response(null, {
                  status: 200,
                  headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                  }
                });
              }
              
              if (c.req.method === 'GET') {
                // Handle the redirect from the dashboard - this should be a simple HTML page
                const url = new URL(c.req.url);
                const backUrl = url.searchParams.get('back_url');
                const ledgerName = url.searchParams.get('local_ledger_name');
                const resultId = url.searchParams.get('result_id');
                
                this.logger.Debug()
                  .Str('backUrl', backUrl || 'none')
                  .Str('ledgerName', ledgerName || 'none')
                  .Str('resultId', resultId || 'none')
                  .Msg('Dashboard redirect received');
                
                // Return a simple HTML page that will auto-close and redirect
                const html = `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta charset="UTF-8">
                    <title>Fireproof Authentication</title>
                    <style>
                      body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                      .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 20px auto; }
                      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    </style>
                  </head>
                  <body>
                    <h2>🔥 Fireproof Authentication</h2>
                    <div class="spinner"></div>
                    <p>Authentication successful! This window will close automatically...</p>
                    <script>
                      // Auto-close the window after 2 seconds
                      setTimeout(() => {
                        window.close();
                      }, 2000);
                    </script>
                  </body>
                  </html>
                `;
                
                return new Response(html, {
                  headers: { 'Content-Type': 'text/html' }
                });
              }
              
              if (c.req.method === 'POST') {
                try {
                  const body = await c.req.json();
                  this.logger.Debug().Any('body', body).Msg('Dashboard token request received');
                  
                  if (body.type === 'reqTokenByResultId') {
                    try {
                      // Generate a proper JWT token using SignJWT directly
                      const token = await new SignJWT({
                        userId: 'demo-user',
                        email: 'demo@example.com',
                        created: new Date(),
                        tenants: [{ id: 'demo-tenant', role: 'admin' }],
                        ledgers: [{ id: 'fireproof-todo-app', role: 'admin', right: 'write' }],
                        selected: {
                          tenant: 'demo-tenant',
                          ledger: 'fireproof-todo-app'
                        }
                      } satisfies FPCloudClaim)
                        .setProtectedHeader({ alg: 'ES256' })
                        .setIssuedAt()
                        .setIssuer('fireproof-demo')
                        .setAudience('fireproof-client')
                        .setExpirationTime('24h')
                        .sign(this.privateKey);
                      
                      const claims: FPCloudClaim = {
                        userId: 'demo-user',
                        email: 'demo@example.com',
                        created: new Date(),
                        tenants: [{ id: 'demo-tenant', role: 'admin' }],
                        ledgers: [{ id: 'fireproof-todo-app', role: 'admin', right: 'write' }],
                        selected: {
                          tenant: 'demo-tenant',
                          ledger: 'fireproof-todo-app'
                        }
                      };
                      
                      const response = {
                        type: 'resTokenByResultId',
                        status: 'found',
                        resultId: body.resultId || 'unknown',
                        token: token
                      };
                      this.logger.Info().Any('response', response).Msg('Sending token response');
                      return c.json(response);
                    } catch (error) {
                      this.logger.Error().Err(error).Msg('Error generating token');
                      return c.json({ error: 'Token generation failed' }, 500);
                    }
                  }
                } catch (error) {
                  this.logger.Error().Err(error).Msg('Error processing dashboard token request');
                  return c.json({ error: 'Invalid request' }, 400);
                }
              }
              
              return c.json({ 
                status: 'ok',
                message: 'Dashboard API endpoint ready',
                timestamp: new Date().toISOString()
              });
            });

    // File upload endpoint for CAR files
    this.app.put('/upload/:filename', async (c: Context) => {
      try {
        const filename = c.req.param('filename');
        this.logger.Info().Str('filename', filename).Msg('File upload request');
        
        const fileData = await c.req.arrayBuffer();
        carFiles.set(filename, new Uint8Array(fileData));
        
        this.logger.Info().Str('filename', filename).Int('size', fileData.byteLength).Msg('File uploaded successfully');
        
        return c.json({ 
          status: 'ok',
          filename,
          size: fileData.byteLength,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logger.Error().Err(error).Msg('File upload error');
        return c.json({ error: 'File upload failed' }, 500);
      }
    });

    // Health check
    this.app.get('/health', (c: Context) => {
      return c.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        fireproof: 'ready'
      });
    });

    // Debug route to catch ALL requests
    this.app.all('*', async (c: Context) => {
      const url = new URL(c.req.url);
      this.logger.Info()
        .Str('method', c.req.method)
        .Str('url', c.req.url)
        .Str('pathname', url.pathname)
        .Str('search', url.search)
        .Str('origin', c.req.header('origin') || 'none')
        .Str('user-agent', c.req.header('user-agent') || 'none')
        .Msg('🔍 ALL REQUESTS DEBUG');
      
      // If it's a PUT request, try to handle it as a Fireproof message or file upload
      if (c.req.method === 'PUT') {
        try {
          // First try to parse as JSON (Fireproof message)
          const msg = await c.req.json() as MsgBase;
          this.logger.Info().Any('🔥 PUT MESSAGE RECEIVED', msg).Msg('Catch-all received Fireproof message');
          
          const ctx = {
            sthis: this.sthis,
            logger: this.logger,
            ende: this.ende,
            wsRoom: this.wsRoom,
            req: {
              method: c.req.method,
              url: c.req.url,
              headers: HttpHeader.from(c.req.header()),
            }
          };

          const response = await this.msgDispatcher.dispatch(ctx, msg);
          this.logger.Info().Any('✅ PUT RESPONSE SENT', response).Msg('Catch-all sending Fireproof response');
          return response;
        } catch (jsonError) {
          // If JSON parsing fails, try to handle as file upload
          try {
            this.logger.Info().Str('url', c.req.url).Msg('🔄 PUT request - trying file upload');
            
            const fileData = await c.req.arrayBuffer();
            const filename = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            carFiles.set(filename, new Uint8Array(fileData));
            
            this.logger.Info().Str('filename', filename).Int('size', fileData.byteLength).Msg('📁 File uploaded via catch-all');
            
            return c.json({ 
              status: 'ok',
              filename,
              size: fileData.byteLength,
              timestamp: new Date().toISOString(),
              message: 'File uploaded via catch-all handler'
            });
          } catch (fileError) {
            this.logger.Error().Err(fileError).Msg('❌ Catch-all error handling file upload');
            return c.json({ error: 'File upload failed' }, 500);
          }
        }
      }
      
      return c.json({ 
        status: 'not found',
        method: c.req.method,
        url: c.req.url,
        timestamp: new Date().toISOString()
      }, 404);
    });

    // Legacy endpoints for backward compatibility
    this.app.all('/fp', async (c: Context) => {
      const url = new URL(c.req.url);
      const car = url.searchParams.get('car');
      const meta = url.searchParams.get('meta');
      
      this.logger.Debug().Str('method', c.req.method).Str('car', car || 'none').Str('meta', meta || 'none').Msg('Legacy endpoint');

      try {
        if (c.req.method === 'PUT') {
          if (car) {
            const carArrayBuffer = await c.req.arrayBuffer();
            carFiles.set(car, new Uint8Array(carArrayBuffer));
            this.logger.Debug().Str('car', car).Msg('Stored CAR file');
            return c.json({ ok: true });
          } else if (meta) {
            const body = await c.req.json();
            let entries: Array<{ data: string; cid: string; parents: string[] }>;
            
            if (Array.isArray(body)) {
              entries = body;
            } else {
              entries = [body];
            }
            
            for (const entry of entries) {
              const { data, cid, parents } = entry;
              metaStore.set(`${meta}/${cid}`, { data, parents });
              this.logger.Debug().Str('meta', meta).Str('cid', cid).Msg('Stored metadata');
            }
            
            return c.json({ ok: true });
          }
        } else if (c.req.method === 'GET') {
          if (car) {
            const carArrayBuffer = carFiles.get(car);
            if (!carArrayBuffer) {
              return c.json({ error: 'CAR file not found' }, 404);
            }
            return c.body(new Uint8Array(carArrayBuffer), 200, {
              'Content-Type': 'application/octet-stream',
            });
          } else if (meta) {
            const entries: Array<{ cid: string; data: string; parents?: string[] }> = [];
            const allParents: string[] = [];

            for (const [key, value] of metaStore.entries()) {
              if (key.startsWith(`${meta}/`)) {
                const cid = key.split('/')[1];
                const { data, parents } = value;
                
                if (parents) {
                  for (const p of parents) {
                    allParents.push(p.toString());
                    metaStore.delete(`${meta}/${p}`);
                  }
                }
                
                entries.push({ cid, data, parents });
              }
            }

            const filteredEntries = entries.filter(
              (entry) => entry.data !== null && !allParents.includes(entry.cid)
            );

            return c.json(filteredEntries);
          }
        } else if (c.req.method === 'DELETE') {
          if (car) {
            carFiles.delete(car);
            return c.json({ ok: true });
          } else if (meta) {
            const keysToDelete: string[] = [];
            for (const key of metaStore.keys()) {
              if (key.startsWith(`${meta}/`)) {
                keysToDelete.push(key);
              }
            }
            keysToDelete.forEach(key => metaStore.delete(key));
            return c.json({ ok: true });
          }
        }

        return c.json({ error: 'Invalid request' }, 400);
      } catch (error) {
        this.logger.Error().Err(error).Msg('Legacy endpoint error');
        return c.json({ error: 'Internal server error' }, 500);
      }
    });
  }

  async start(port: number = 3001): Promise<void> {
    serve({
      fetch: this.app.fetch,
      port,
    });

    this.logger.Info().Int('port', port).Msg('Fireproof backend server started');
    this.logger.Info().Str('url', `http://localhost:${port}`).Msg('Server URL');
    this.logger.Info().Str('fp', `http://localhost:${port}/fp`).Msg('Fireproof API');
    this.logger.Info().Str('ws', `ws://localhost:${port}/ws`).Msg('WebSocket endpoint');
  }
}
