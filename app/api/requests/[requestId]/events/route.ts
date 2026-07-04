import { NextResponse } from 'next/server';
import { eventsForResult, getStoredRequest } from '../../../_corify';

export const runtime = 'nodejs';

export function GET(
  _request: Request,
  context: { params: Promise<{ requestId: string }> }
): Promise<Response> {
  return context.params.then(({ requestId }) => {
    const result = getStoredRequest(requestId);
    if (!result) {
      return NextResponse.json({ error: 'request not found' }, { status: 404 });
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        for (const event of eventsForResult(result)) {
          controller.enqueue(
            encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
          );
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'content-type': 'text/event-stream',
      },
    });
  });
}
