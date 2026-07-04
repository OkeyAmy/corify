import { NextResponse } from 'next/server';
import { getStoredRequest } from '../../_corify';

export const runtime = 'nodejs';

export function GET(
  _request: Request,
  context: { params: Promise<{ requestId: string }> }
): Promise<NextResponse> {
  return context.params.then(({ requestId }) => {
    const result = getStoredRequest(requestId);
    if (!result) {
      return NextResponse.json({ error: 'request not found' }, { status: 404 });
    }
    return NextResponse.json(result);
  });
}
