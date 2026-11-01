import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.EMBEDDING_API_KEY;
const model = process.env.EMBEDDING_MODEL ?? "gemini-embedding-2";
const dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? 768);

if (!url || !serviceKey || !apiKey || apiKey.startsWith("YOUR_")) {
  console.error("Isi NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, dan EMBEDDING_API_KEY.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function embed(texts) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text }] },
          outputDimensionality: dimensions,
        })),
      }),
    },
  );
  const body = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(body).slice(0, 400));
  const vectors = (body.embeddings ?? []).map((item) => item.values);
  if (vectors.length !== texts.length) throw new Error("Jumlah vektor tidak cocok.");
  return vectors;
}

let updated = 0;
let failed = 0;

while (true) {
  const { data: chunks, error } = await admin
    .from("manuscript_chunks")
    .select("id, text")
    .is("embedding", null)
    .limit(100);
  if (error) throw error;
  if (!chunks || chunks.length === 0) break;

  const vectors = await embed(chunks.map((chunk) => chunk.text));
  let batchFailed = 0;
  for (let index = 0; index < chunks.length; index += 1) {
    const { error: updateError } = await admin
      .from("manuscript_chunks")
      .update({ embedding: vectors[index], embedding_model: model })
      .eq("id", chunks[index].id);
    if (updateError) {
      batchFailed += 1;
      failed += 1;
      console.error("update gagal:", chunks[index].id, updateError.message);
    } else {
      updated += 1;
    }
  }
  if (batchFailed === chunks.length) break;
}

console.log(JSON.stringify({ updated, failed, model, dimensions }));
