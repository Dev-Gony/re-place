"use client";

import type {
  RecordItem,
  TaskMutationItem,
  WorkspaceSnapshot,
} from "./workspace-contract";

export type WorkspaceSession = {
  schemaVersion: 1;
  authTransport: "cookie-session";
  authenticated: boolean;
  user: null | {
    id: string;
    name: string | null;
    email: string | null;
  };
};

type MutationEnvelope<T> = {
  schemaVersion: 1;
  mutatedAt: string;
  data: T;
};

type ErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class WorkspaceApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "WorkspaceApiError";
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = (payload ?? {}) as ErrorEnvelope;
    throw new WorkspaceApiError(
      response.status,
      error.error?.code ?? "REQUEST_FAILED",
      error.error?.message ?? "Request failed",
    );
  }

  return payload as T;
}

export function getWorkspace() {
  return requestJson<WorkspaceSnapshot>("/api/v1/me/workspace");
}

export function getWorkspaceSession() {
  return requestJson<WorkspaceSession>("/api/v1/me/session");
}

export function addFavorite(campaignId: number) {
  return requestJson<MutationEnvelope<{ favorited: true }>>(
    "/api/v1/me/favorites",
    {
      method: "POST",
      body: JSON.stringify({ campaignId }),
    },
  );
}

export function removeFavorite(campaignId: number) {
  return requestJson<MutationEnvelope<{ favorited: false; campaignId: number }>>(
    `/api/v1/me/favorites/${campaignId}`,
    { method: "DELETE" },
  );
}

export function createRecord(input: Record<string, unknown>) {
  return requestJson<MutationEnvelope<{ item: RecordItem }>>(
    "/api/v1/me/records",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateRecord(id: number, input: Record<string, unknown>) {
  return requestJson<MutationEnvelope<{ item: RecordItem }>>(
    `/api/v1/me/records/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deleteRecord(id: number) {
  return requestJson<MutationEnvelope<{ deleted: true; id: number }>>(
    `/api/v1/me/records/${id}`,
    { method: "DELETE" },
  );
}

export function createTask(input: Record<string, unknown>) {
  return requestJson<
    MutationEnvelope<{ item: TaskMutationItem; created: boolean }>
  >(
    "/api/v1/me/tasks",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateTask(id: number, input: Record<string, unknown>) {
  return requestJson<MutationEnvelope<{ item: TaskMutationItem }>>(
    `/api/v1/me/tasks/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deleteTask(id: number) {
  return requestJson<MutationEnvelope<{ deleted: true; id: number }>>(
    `/api/v1/me/tasks/${id}`,
    { method: "DELETE" },
  );
}

export function saveSettlement(
  recordId: number,
  input: Record<string, unknown>,
) {
  return requestJson<MutationEnvelope<{ item: unknown }>>(
    `/api/v1/me/settlements/${recordId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}
