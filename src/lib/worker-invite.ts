import { type Timesheet } from "./timesheet-store";

export type WorkerInvitePayload = {
  version: 1;
  timesheet: Timesheet;
};

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64Url(value: string): string {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = window.atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function buildWorkerInviteUrl(t: Timesheet): string {
  const payload: WorkerInvitePayload = {
    version: 1,
    timesheet: t,
  };
  const encoded = encodeBase64Url(JSON.stringify(payload));
  const basePath = import.meta.env.BASE_URL ?? "/";
  return `${window.location.origin}${basePath}vikar/invite#invite=${encoded}`;
}

export function parseWorkerInviteFromHash(hash: string): WorkerInvitePayload | undefined {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const encoded = params.get("invite");
  if (!encoded) return undefined;

  try {
    const parsed = JSON.parse(decodeBase64Url(encoded)) as WorkerInvitePayload;
    if (parsed.version !== 1 || !parsed.timesheet?.id) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}
