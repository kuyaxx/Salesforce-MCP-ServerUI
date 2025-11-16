// src/types/mcp-ui-server.d.ts
declare module '@mcp-ui/server' {
  // Minimal shim so TS stops complaining; keep it loose on purpose.
  export function createUIResource(args: any): any;
}
