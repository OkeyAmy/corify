import { NextResponse } from 'next/server';
import { parseWantPayload, runAuction } from '../_corify';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as unknown;
    const want = parseWantPayload(body);
    const forceBadDelivery =
      typeof body === 'object' &&
      body !== null &&
      'forceBadDelivery' in body &&
      body.forceBadDelivery === true &&
      want.questionType === 'wallet_activity';
    return NextResponse.json(await runAuction(want, forceBadDelivery));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
