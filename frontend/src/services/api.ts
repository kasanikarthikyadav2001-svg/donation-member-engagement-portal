export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}
let csrf = "";
export const setCsrf = (value: string) => {
  csrf = value;
};
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      response.status,
      data.error?.message || "Unable to complete the request.",
      data.error?.fields,
    );
  return data;
}
export const send = (path: string, body: unknown, method = "POST") =>
  api(path, { method, body: JSON.stringify(body) });
export const downloadReceipt = (id: string) => {
  window.location.assign(`/api/receipts/${id}/download`);
};
