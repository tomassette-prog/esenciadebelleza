import { NextResponse } from 'next/server';

function getTextFromPayload(payload: any): string {
  if (typeof payload?.content === 'string') return payload.content;
  if (typeof payload?.text === 'string') return payload.text;
  if (Array.isArray(payload?.choices) && payload.choices.length > 0) {
    const choice = payload.choices[0];
    if (typeof choice?.message?.content === 'string') return choice.message.content;
    if (typeof choice?.text === 'string') return choice.text;
  }

  if (Array.isArray(payload?.outputs) && payload.outputs.length > 0) {
    const output = payload.outputs[0];
    if (typeof output?.text === 'string') return output.text;
    if (typeof output?.content === 'string') return output.content;
  }

  return '';
}

function normalizeMessages(body: any): Array<{ role: string; content: string }> {
  const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
  const messages = Array.isArray(body?.messages) ? body.messages : [];

  if (messages.length > 0) {
    return messages
      .filter((item: any) => item && typeof item?.content === 'string')
      .map((item: any) => ({ role: item.role || 'user', content: item.content }));
  }

  return [{ role: 'user', content: prompt }];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiBaseUrl = process.env.XIAOMI_MIMO_API_URL || 'https://token-plan-ams.xiaomimimo.com/v1';
    const apiKey = process.env.XIAOMI_MIMO_API_KEY;
    const model = body?.model || process.env.XIAOMI_MIMO_MODEL || 'mimo-v2.5-pro';

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Falta la credencial. Define XIAOMI_MIMO_API_KEY en tu entorno.',
        },
        { status: 500 },
      );
    }

    const endpoint = apiBaseUrl.endsWith('/chat/completions')
      ? apiBaseUrl
      : `${apiBaseUrl.replace(/\/$/, '')}/chat/completions`;

    const payload = {
      model,
      messages: normalizeMessages(body),
      temperature: body?.temperature ?? 1.0,
      max_completion_tokens: body?.max_tokens ?? body?.max_completion_tokens ?? 1024,
      stream: false,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    let data: any = null;

    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = { raw: rawText };
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'La llamada al modelo falló.',
          status: response.status,
          details: data,
        },
        { status: response.status },
      );
    }

    const content = getTextFromPayload(data);

    return NextResponse.json({
      content,
      raw: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'No se pudo procesar la solicitud.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
