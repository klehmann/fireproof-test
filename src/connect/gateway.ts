import { Result, URI } from "@adviser/cement";
import { NotFoundError, PARAM, SuperThis } from "@fireproof/core-types-base";
import { 
  SerdeGateway, 
  SerdeGatewayCtx,
  FPEnvelope,
  FPEnvelopeTypes,
  FPEnvelopeMeta
} from "@fireproof/core-types-blockstore";
import { registerStoreProtocol } from "@fireproof/core";
import { ensureLogger } from "@fireproof/core-runtime";

function cleanURI(uri: URI): URI {
  return uri
    .build()
    .cleanParams(
      PARAM.VERSION,
      PARAM.NAME,
      PARAM.STORE_KEY,
      PARAM.SELF_REFLECT,
      PARAM.LOCAL_NAME,
    )
    .URI();
}

/**
 * HTTP SerdeGateway for connecting to your Hono server
 * Implements the SerdeGateway interface following the test patterns
 */
export class HttpSerdeGateway implements SerdeGateway {
  readonly baseUrl: string;
  readonly sthis: SuperThis;

  constructor(sthis: SuperThis, baseUrl: string) {
    this.sthis = sthis;
    this.baseUrl = baseUrl;
  }

  async buildUrl(_ctx: SerdeGatewayCtx, baseUrl: URI, key: string): Promise<Result<URI>> {
    return Promise.resolve(Result.Ok(baseUrl.build().setParam(PARAM.KEY, key).URI()));
  }

  async start(_ctx: SerdeGatewayCtx, baseUrl: URI): Promise<Result<URI>> {
    return Promise.resolve(Result.Ok(baseUrl.build().setParam(PARAM.VERSION, "1.0.0").URI()));
  }

  async close(_ctx: SerdeGatewayCtx, _baseUrl: URI): Promise<Result<void>> {
    return Promise.resolve(Result.Ok(undefined));
  }

  async destroy(_ctx: SerdeGatewayCtx, _baseUrl: URI): Promise<Result<void>> {
    return Promise.resolve(Result.Ok(undefined));
  }

  async put<T>(ctx: SerdeGatewayCtx, url: URI, envelope: FPEnvelope<T>): Promise<Result<void>> {
    const logger = ensureLogger(ctx.loader.sthis, "HttpSerdeGateway");
    const store = url.getParam(PARAM.STORE);
    
    try {
      if (store === "car") {
        logger.Debug().Url(url).Msg("put-car");
        const key = url.getParam(PARAM.KEY) || cleanURI(url).toString();
        
        // Convert envelope payload to bytes
        const payloadBytes = new TextEncoder().encode(JSON.stringify(envelope.payload));
        
        const response = await fetch(`${this.baseUrl}/fp?car=${encodeURIComponent(key)}`, {
          method: 'PUT',
          body: payloadBytes,
          headers: { 'Content-Type': 'application/octet-stream' }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } else if (store === "meta") {
        logger.Debug().Url(url).Msg("put-meta");
        const meta = url.getParam(PARAM.NAME) || "main";
        const key = url.getParam(PARAM.KEY) || cleanURI(url).toString();
        
        // Convert envelope to the format our server expects
        const entry = {
          cid: key,
          data: JSON.stringify(envelope.payload),
          parents: []
        };
        
        const response = await fetch(`${this.baseUrl}/fp?meta=${encodeURIComponent(meta)}`, {
          method: 'PUT',
          body: JSON.stringify(entry),
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }
      
      return Result.Ok(undefined);
    } catch (error) {
      logger.Error().Err(error as Error).Url(url).Msg("put failed");
      return Result.Err(error as Error);
    }
  }

  async get<S>(ctx: SerdeGatewayCtx, url: URI): Promise<Result<FPEnvelope<S>>> {
    const logger = ensureLogger(ctx.loader.sthis, "HttpSerdeGateway");
    const store = url.getParam(PARAM.STORE);
    
    try {
      if (store === "car") {
        logger.Debug().Url(url).Msg("get-car");
        const key = url.getParam(PARAM.KEY) || cleanURI(url).toString();
        const response = await fetch(`${this.baseUrl}/fp?car=${encodeURIComponent(key)}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            return Result.Err(new NotFoundError(`CAR file not found: ${key}`));
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const payload = new TextDecoder().decode(arrayBuffer);
        
        return Result.Ok({
          type: FPEnvelopeTypes.CAR,
          payload: JSON.parse(payload) as S
        });
      } else if (store === "meta") {
        logger.Debug().Url(url).Msg("get-meta");
        const meta = url.getParam(PARAM.NAME) || "main";
        const response = await fetch(`${this.baseUrl}/fp?meta=${encodeURIComponent(meta)}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            return Result.Err(new NotFoundError(`Meta not found: ${meta}`));
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const entries = await response.json();
        
        // Convert the entries to the format Fireproof expects
        // Fireproof expects DbMetaEvent[] format
        const fireproofMeta = entries.map((entry: any) => ({
          eventCid: entry.cid, // This should be a CarClockLink
          parents: entry.parents || [], // This should be CarClockHead
          dbMeta: {
            cars: entry.cid ? [entry.cid] : [] // This should be CarGroup
          }
        }));
        
        return Result.Ok({
          type: FPEnvelopeTypes.META,
          payload: fireproofMeta as S
        });
      }
      
      return Result.Err(new NotFoundError(`Unknown store type: ${store}`));
    } catch (error) {
      logger.Error().Err(error as Error).Url(url).Msg("get failed");
      return Result.Err(error as Error);
    }
  }

  async delete(_ctx: SerdeGatewayCtx, url: URI): Promise<Result<void>> {
    const store = url.getParam(PARAM.STORE);
    
    try {
      if (store === "car") {
        const key = url.getParam(PARAM.KEY) || cleanURI(url).toString();
        const response = await fetch(`${this.baseUrl}/fp?car=${encodeURIComponent(key)}`, {
          method: 'DELETE'
        });
        
        if (!response.ok && response.status !== 404) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } else if (store === "meta") {
        const meta = url.getParam(PARAM.NAME) || "main";
        const response = await fetch(`${this.baseUrl}/fp?meta=${encodeURIComponent(meta)}`, {
          method: 'DELETE'
        });
        
        if (!response.ok && response.status !== 404) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }
      
      return Result.Ok(undefined);
    } catch (error) {
      return Result.Err(error as Error);
    }
  }

  async subscribe(
    _ctx: SerdeGatewayCtx, 
    _url: URI, 
    _callback: (meta: FPEnvelopeMeta) => Promise<void>
  ): Promise<Result<() => void>> {
    // For now, return a no-op unsubscribe function
    // Real-time subscriptions would require WebSocket support
    return Result.Ok(() => {});
  }

  async getPlain(_ctx: SerdeGatewayCtx, _url: URI, key: string): Promise<Result<Uint8Array>> {
    try {
      const response = await fetch(`${this.baseUrl}/fp?car=${encodeURIComponent(key)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return Result.Err(new NotFoundError("not found"));
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      return Result.Ok(new Uint8Array(arrayBuffer));
    } catch (error) {
      return Result.Err(error as Error);
    }
  }
}

/**
 * Register HTTP protocol for connecting to your Hono server
 */
function registerHttpProtocol() {
  registerStoreProtocol({
    protocol: "http:",
    isDefault: false,
    defaultURI: () => {
      return URI.from("http://localhost:3001");
    },
    serdegateway: async (sthis) => {
      return new HttpSerdeGateway(sthis, "http://localhost:3001");
    },
  });
}

// Register the HTTP protocol
registerHttpProtocol();

/**
 * HTTP-based Fireproof connection for local development
 * This connects directly to your Hono server using a custom protocol
 */
export function createLocalFireproofConnection(serverUrl: string = "http://localhost:3001") {
  const httpUrl = URI.from(serverUrl);
  
  return {
    storeUrls: {
      base: httpUrl,
    },
  };
}
