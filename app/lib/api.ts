import type {
  AuctionResult,
  CatalogEntry,
  HealthPayload,
  WantRequest,
  AuctionEvent,
} from './types';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
  });
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : 'Request failed';
    throw new Error(message);
  }
  return payload as T;
}

export function getHealth(): Promise<HealthPayload> {
  return requestJson<HealthPayload>('/api/health');
}

export function getCatalog(): Promise<Array<CatalogEntry>> {
  return requestJson<Array<CatalogEntry>>('/api/catalog');
}

export function postWant(input: WantRequest): Promise<AuctionResult> {
  return requestJson<AuctionResult>('/api/want', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getRequest(requestId: string): Promise<AuctionResult> {
  return requestJson<AuctionResult>(
    `/api/requests/${encodeURIComponent(requestId)}`
  );
}

export function subscribeRequestEvents(
  requestId: string,
  onEvent: (event: AuctionEvent) => void,
  onError: () => void
): () => void {
  if (typeof EventSource === 'undefined') return () => undefined;
  const source = new EventSource(
    `/api/requests/${encodeURIComponent(requestId)}/events`
  );
  source.onmessage = (message) => {
    onEvent(JSON.parse(String(message.data)) as AuctionEvent);
  };
  source.onerror = () => {
    source.close();
    onError();
  };
  return () => {
    source.close();
  };
}
