export interface ApiRequest {
  url: string;
  method: string;
  body?: BodyInit | Record<string, unknown> | null;
  queryParams?: Record<string, unknown>;
  useCredentials?: boolean;
  headers?: Record<string, string>;
  nextOption?: Omit<RequestInit, 'method' | 'body' | 'headers' | 'credentials'>;
  isPublic?: boolean;
  isFormData?: boolean;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  statusCode?: number;
  message?: string;
  error?: string;
}

export interface PaginatedModel<T> {
  meta: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
  result: T[];
}
