/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_DATABASE_URL?: string;
  readonly VITE_USE_EMULATORS?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_OPERATOR_NAME?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;
