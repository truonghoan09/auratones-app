/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;           // ví dụ: http://localhost:3001/api
  readonly VITE_TOKEN_STORAGE_KEY?: string;  // auratones_token
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}