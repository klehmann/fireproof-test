import { createLocalFireproofConnection } from "./gateway";

export function connectToLocalServer(serverUrl: string = "http://localhost:3001") {
  return createLocalFireproofConnection(serverUrl);
}
