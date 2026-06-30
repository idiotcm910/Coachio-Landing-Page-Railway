export const SESSION_STORAGE_KEYS = {
  REGISTERED_EMAIL: 'registered_email',
  VERIFICATION_EMAIL_CONTEXT: 'verification_email_context',
} as const;

export type SessionStorageKey = (typeof SESSION_STORAGE_KEYS)[keyof typeof SESSION_STORAGE_KEYS];

export const LOCAL_STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  TOKEN_TYPE: 'token_type',
  API_SERVICE_KEY: 'api_service_key',
} as const;

export type LocalStorageKey = (typeof LOCAL_STORAGE_KEYS)[keyof typeof LOCAL_STORAGE_KEYS];
