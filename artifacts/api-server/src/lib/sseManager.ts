import type { Response } from "express";

const categoryClients = new Map<number, Set<Response>>();
const globalClients = new Set<Response>();

function sendEvent(res: Response, event: string, data: unknown): void {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Client disconnected — will be cleaned up on 'close' event
  }
}

export function subscribeCategory(skillCategoryId: number, res: Response): void {
  if (!categoryClients.has(skillCategoryId)) {
    categoryClients.set(skillCategoryId, new Set());
  }
  categoryClients.get(skillCategoryId)!.add(res);
}

export function unsubscribeCategory(skillCategoryId: number, res: Response): void {
  categoryClients.get(skillCategoryId)?.delete(res);
}

export function subscribeGlobal(res: Response): void {
  globalClients.add(res);
}

export function unsubscribeGlobal(res: Response): void {
  globalClients.delete(res);
}

export function broadcastCategory(
  skillCategoryId: number,
  event: string,
  data: unknown,
): void {
  const subs = categoryClients.get(skillCategoryId);
  if (subs) {
    for (const res of subs) sendEvent(res, event, data);
  }
  for (const res of globalClients) {
    sendEvent(res, event, { skillCategoryId, ...(data as object) });
  }
}

export function broadcastAll(event: string, data: unknown): void {
  for (const subs of categoryClients.values()) {
    for (const res of subs) sendEvent(res, event, data);
  }
  for (const res of globalClients) sendEvent(res, event, data);
}
