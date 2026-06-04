import { NextResponse } from 'next/server';
import { agentDispatch } from '@/lib/server-utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phoneNumber, leadName, businessName, serviceType, agentProfile, overridePrompt, customPrompt } = body;

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Normalize phone number (ensure +91 format)
    let phone = phoneNumber.trim();
    if (!phone.startsWith('+')) {
      phone = '+91' + phone.replace(/^0/, '');
    }

    const roomName = `call-${phone.replace(/\+/g, '')}-${Math.floor(Math.random() * 9000) + 1000}`;

    const metadata: Record<string, string> = {
      phone_number: phone,
      model_provider: 'gemini',
      voice_id: 'kavya',
    };

    if (leadName) metadata.lead_name = leadName;
    if (businessName) metadata.business_name = businessName;
    if (serviceType) metadata.service_type = serviceType;
    if (overridePrompt && customPrompt) metadata.custom_prompt = customPrompt;

    console.log(`Dispatching agent for ${phone} → room: ${roomName}`);

    const dispatch = await agentDispatch.createDispatch(
      roomName,
      'outbound-caller',
      { metadata: JSON.stringify(metadata) }
    );

    return NextResponse.json({
      success: true,
      phone,
      roomName,
      dispatchId: dispatch.id,
      message: `Call dispatched to ${phone}`,
    });

  } catch (error: any) {
    console.error('Dispatch error:', error);
    return NextResponse.json({ error: error.message || 'Dispatch failed' }, { status: 500 });
  }
}
