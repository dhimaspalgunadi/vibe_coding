import { NextResponse } from 'next/server';
import { redis } from '../../../lib/redis';
import { TEAM_MEMBERS } from '../../../data/team';
import { STATUS_OPTIONS, MAX_TASK_LENGTH } from '../../../lib/status';

const KV_KEY = 'papan-status-tim';

export async function GET() {
  const stored = (await redis.get(KV_KEY)) || {};

  const members = TEAM_MEMBERS.map((name) => {
    const entry = stored[name];
    return {
      name,
      status: entry?.status || STATUS_OPTIONS[0],
      task: entry?.task || '',
      updatedAt: entry?.updatedAt || null,
    };
  });

  return NextResponse.json({ members });
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const name = body?.name;
  const status = body?.status;
  const task = body?.task;

  if (!TEAM_MEMBERS.includes(name)) {
    return NextResponse.json({ error: 'Nama tidak dikenal' }, { status: 400 });
  }
  if (!STATUS_OPTIONS.includes(status)) {
    return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 });
  }

  const cleanTask = String(task || '').slice(0, MAX_TASK_LENGTH);
  const stored = (await redis.get(KV_KEY)) || {};
  const updatedAt = Date.now();

  stored[name] = { status, task: cleanTask, updatedAt };
  await redis.set(KV_KEY, stored);

  return NextResponse.json({ name, status, task: cleanTask, updatedAt });
}
