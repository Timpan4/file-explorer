/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EXPLORER_NAV_DELAY_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
