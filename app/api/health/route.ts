import { NextResponse } from 'next/server';
import { health } from '../_corify';

export const runtime = 'nodejs';

export function GET(): NextResponse {
  return NextResponse.json(health());
}
