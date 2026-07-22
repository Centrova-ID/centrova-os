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

    const { clientId, projectId, additionalContext } = await req.json();

    // Fetch AI settings
    const { data: settings } = await supabase
      .from("ai_settings")
      .select("*")
      .eq("id", "00000000-0000-0000-0000-000000000002")
      .maybeSingle();

    if (!settings?.api_key) {
      return new Response(
        JSON.stringify({ error: "AI belum dikonfigurasi. Silakan atur API Key di halaman AI Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parallel data fetch
    const [clientRes, projectRes, catalogRes, pastInvoicesRes, companyRes, invoiceNumRes] = await Promise.all([
      clientId
        ? supabase.from("clients").select("company_name,pic_name,email,address").eq("id", clientId).maybeSingle()
        : Promise.resolve({ data: null }),
      projectId
        ? supabase.from("projects").select("name,service,description,status").eq("id", projectId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("service_catalog").select("name,description,billing_type,default_price,unit").eq("is_active", true).is("deleted_at", null).limit(20),
      clientId
        ? supabase.from("invoices").select("invoice_number,total,notes,issue_date").eq("client_id", clientId).eq("status", "paid").is("deleted_at", null).order("created_at", { ascending: false }).limit(3)
        : Promise.resolve({ data: [] }),
      supabase.from("company_profile").select("name,address,email,bank_name,bank_account_number,bank_account_name").eq("id", "00000000-0000-0000-0000-000000000001").maybeSingle(),
      supabase.rpc("get_next_invoice_number"),
    ]);

    const client = clientRes.data;
    const project = projectRes.data;
    const catalog = catalogRes.data || [];
    const pastInvoices = pastInvoicesRes.data || [];
    const company = companyRes.data;
    const invoiceNumber = invoiceNumRes.data || `INV-${Date.now()}`;

    // Build context
    const contextParts: string[] = [];
    if (company) contextParts.push(`### Company:\nName: ${company.name}\nAddress: ${company.address || ""}\nEmail: ${company.email || ""}\nBank: ${company.bank_name} - ${company.bank_account_number} (${company.bank_account_name})`);
    if (client) contextParts.push(`### Client:\nCompany: ${client.company_name}\nPIC: ${client.pic_name || ""}\nEmail: ${client.email || ""}\nAddress: ${client.address || ""}`);
    if (project) contextParts.push(`### Project:\nName: ${project.name}\nService: ${project.service || ""}\nDescription: ${project.description || ""}\nStatus: ${project.status}`);
    if (catalog.length) contextParts.push(`### Service Catalog:\n${catalog.map(s => `- ${s.name}: ${s.default_price} IDR/${s.unit || "project"} (${s.billing_type})`).join("\n")}`);
    if (pastInvoices.length) contextParts.push(`### Past Invoices (for reference):\n${pastInvoices.map(i => `- ${i.invoice_number}: ${i.total} IDR on ${i.issue_date}`).join("\n")}`);
    if (additionalContext) contextParts.push(`### Additional Context:\n${additionalContext}`);

    const context = contextParts.join("\n\n");
    const today = new Date().toISOString().split("T")[0];
    const due = new Date();
    due.setDate(due.getDate() + 14);
    const dueDate = due.toISOString().split("T")[0];

    const systemPrompt = `You are an invoice generator for ${company?.name || "a company"}. Generate professional invoices based on context. Always respond with valid JSON only, no markdown fences.`;

    const userPrompt = `Generate a draft invoice using the context below. Return ONLY a JSON object with these fields:
- invoice_number: string (use the provided number)
- notes: string (invoice notes/subject for client)
- payment_notes: string (payment instructions including bank details if available)
- due_date: string (YYYY-MM-DD, default 14 days from today: ${dueDate})
- items: array of { description: string, quantity: number, unit_price: number, discount: number }

Invoice number to use: ${invoiceNumber}
Today: ${today}

Context:
${context}

Respond with JSON only.`;

    const aiRes = await fetch(`${settings.base_url}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.api_key}`,
      },
      body: JSON.stringify({
        model: settings.model_name,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: Math.min(settings.max_tokens || 2048, 1500),
        temperature: 0.3,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return new Response(
        JSON.stringify({ error: `AI API error (${aiRes.status}): ${errText.slice(0, 200)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiRes.json();
    let content = aiData.choices?.[0]?.message?.content || "";

    // Strip markdown fences
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let draft: Record<string, unknown>;
    try {
      draft = JSON.parse(content);
    } catch {
      return new Response(
        JSON.stringify({ error: "AI returned invalid JSON. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sanitize items
    const rawItems = Array.isArray(draft.items) ? draft.items : [];
    const items = rawItems.map((item: Record<string, unknown>, i: number) => ({
      description: String(item.description || `Item ${i + 1}`),
      quantity: Math.max(1, Number(item.quantity) || 1),
      unit_price: Math.max(0, Number(item.unit_price) || 0),
      discount: Math.min(100, Math.max(0, Number(item.discount) || 0)),
      sort_order: i,
    }));

    return new Response(
      JSON.stringify({
        draft: {
          invoice_number: String(draft.invoice_number || invoiceNumber),
          notes: String(draft.notes || ""),
          payment_notes: String(draft.payment_notes || ""),
          due_date: String(draft.due_date || dueDate),
          items,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
