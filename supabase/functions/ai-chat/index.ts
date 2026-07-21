import { createClient } from "npm:@supabase/supabase-js@2.110.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { messages, context, chatId } = await req.json();

    // Fetch AI settings
    const { data: settings } = await supabase
      .from("ai_settings")
      .select("*")
      .eq("id", "00000000-0000-0000-0000-000000000002")
      .maybeSingle();

    if (!settings || !settings.api_key) {
      return new Response(
        JSON.stringify({
          error: "AI belum dikonfigurasi. Silakan atur API Key di halaman AI Settings.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build the system prompt with context
    const systemPrompt = [
      settings.system_prompt || "",
      context ? "\n\n## Data Operasional Centrova:\n" + context : "",
    ].join("");

    // Call the AI provider
    const response = await fetch(`${settings.base_url}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.api_key}`,
      },
      body: JSON.stringify({
        model: settings.model_name,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        max_tokens: settings.max_tokens,
        temperature: settings.temperature,
        top_p: settings.top_p,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      return new Response(
        JSON.stringify({
          error: `AI API error (${response.status}): ${errText.slice(0, 200)}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || "Maaf, tidak ada respons dari AI.";

    // Save messages if chatId provided
    if (chatId) {
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg && lastUserMsg.role === "user") {
        await supabase.from("ai_messages").insert([
          { chat_id: chatId, role: "user", content: lastUserMsg.content },
          { chat_id: chatId, role: "assistant", content: assistantMessage },
        ]);
      }
    }

    return new Response(
      JSON.stringify({ message: assistantMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
