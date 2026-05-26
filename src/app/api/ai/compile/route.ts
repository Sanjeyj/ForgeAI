import { NextRequest, NextResponse } from 'next/server';
import { compilePromptToSchema } from '@/lib/ai/prompt-compiler';
import { runtimeLogger } from '@/lib/logger/runtime-logger';
import { verifyToken } from '@/lib/auth/jwt';

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const sessionCookie = req.cookies.get('forgeai_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = await verifyToken(sessionCookie);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Call dual-mode prompt compiler
    const schema = await compilePromptToSchema(prompt);

    runtimeLogger.info('ai', `AI Schema Compiled for prompt: "${prompt.slice(0, 30)}..."`);
    return NextResponse.json({ success: true, schema });
  } catch (error) {
    runtimeLogger.error('ai', 'AI compiler API crash', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Failed to compile prompt' }, { status: 500 });
  }
}
