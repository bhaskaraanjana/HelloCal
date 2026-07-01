// Supabase Edge Function — proxies Gemini with a server-held GEMINI_API_KEY.
// Deploy: supabase functions deploy gemini-proxy --no-verify-jwt
// Secrets: supabase secrets set GEMINI_API_KEY=your_key

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const geminiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'HelloCal AI is not configured on the server.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const parts = body?.parts;
    const modelName = typeof body?.model === 'string' ? body.model : 'gemini-2.5-flash';

    if (!Array.isArray(parts) || parts.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' },
    });

    const result = await model.generateContent(parts);
    const resp = result.response;
    const blockReason = resp?.promptFeedback?.blockReason;
    const finishReason = resp?.candidates?.[0]?.finishReason;
    if (blockReason || finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'OTHER') {
      return new Response(JSON.stringify({ error: "The AI couldn't process that input. Try rephrasing or a clearer photo." }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let text: string;
    try {
      text = resp.text();
    } catch {
      return new Response(JSON.stringify({ error: 'The AI returned an empty response.' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
