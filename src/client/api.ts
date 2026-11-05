import type {
  ApiErrorBody,
  ApiSessionResponse,
  RoomSummary,
  Session,
} from '../shared/types';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError('无法连接服务器，请检查网络', 0);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Keep the fallback message below.
  }

  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiError(error || '请求失败，请稍后再试', response.status);
  }

  return body as T;
}

export function createRoom(playerName: string): Promise<Session> {
  return request<ApiSessionResponse>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ playerName }),
  });
}

export function joinRoom(roomCode: string, playerName: string): Promise<Session> {
  return request<ApiSessionResponse>(`/api/rooms/${encodeURIComponent(roomCode)}/join`, {
    method: 'POST',
    body: JSON.stringify({ playerName }),
  });
}

export function getRoom(roomCode: string): Promise<RoomSummary> {
  return request<RoomSummary>(`/api/rooms/${encodeURIComponent(roomCode)}`);
}
