import { NextResponse } from 'next/server';
import { catalog } from '../_corify';

export const runtime = 'nodejs';

export function GET(): NextResponse {
  return NextResponse.json(catalog);
}
