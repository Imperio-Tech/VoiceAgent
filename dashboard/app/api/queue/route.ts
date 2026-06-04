import { NextResponse } from 'next/server';
import { agentDispatch } from '@/lib/server-utils';

interface CsvRow {
  phone: string;
  leadName?: string;
  businessName?: string;
  serviceType?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { leads, numbers, campaignName, delayMs = 3000, customPrompt } = body;

    // Accept either `leads` (CSV rows with metadata) or legacy `numbers` array
    const items: CsvRow[] = leads
      ? leads
      : (numbers || []).map((n: string) => ({ phone: n }));

    if (!items.length) {
      return NextResponse.json({ error: 'No phone numbers provided' }, { status: 400 });
    }

    const results = [];

    for (const row of items) {
      let phone = (row.phone || '').toString().trim();
      if (!phone) continue;
      if (!phone.startsWith('+')) {
        phone = '+91' + phone.replace(/^0/, '');
      }

      try {
        const rand = Math.floor(Math.random() * 9000) + 1000;
        const roomName = `call-${phone.replace(/\+/g, '')}-${rand}`;
        const metadata = JSON.stringify({
          phone_number: phone,
          model_provider: 'gemini',
          voice_id: 'kavya',
          campaign: campaignName || '',
          lead_name: row.leadName || '',
          business_name: row.businessName || 'Imperio Railing Systems',
          service_type: row.serviceType || 'railing-inquiry',
          ...(customPrompt ? { custom_prompt: customPrompt } : {}),
        });

        const dispatch = await agentDispatch.createDispatch(
          roomName,
          'outbound-caller',
          { metadata }
        );

        results.push({ phone, status: 'dispatched', dispatchId: dispatch.id, roomName });
        console.log(`Queued: ${phone} → ${roomName}`);
      } catch (e: any) {
        console.error(`Failed to dispatch ${phone}:`, e);
        results.push({ phone, status: 'failed', error: e.message });
      }

      if (delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }

    const dispatched = results.filter(r => r.status === 'dispatched').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      message: `${dispatched} dispatched, ${failed} failed`,
      results,
    });

  } catch (error: any) {
    console.error('Queue error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
