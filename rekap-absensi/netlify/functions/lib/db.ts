import { getDatabase } from "@netlify/database";

let instance: ReturnType<typeof getDatabase> | null = null;

export function db() {
  if (!instance) instance = getDatabase();
  return instance;
}
