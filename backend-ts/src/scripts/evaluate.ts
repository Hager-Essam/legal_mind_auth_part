import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "../config/env";
import { createServices } from "../services/service-container";
import type { QueryResponse } from "../schemas";
import questions from "./evaluation_questions.json";

// ── Types ──────────────────────────────────────────────────────────────────

type EvalQuestion = {
  id: string;
  query: string;
  category: string;
  type: string;
  expected_concept?: string;
};

type JudgeScore = {
  score: number;
  reason: string;
};

type EvalResult = {
  id: string;
  query: string;
  category: string;
  answer: string;
  source_count: number;
  faithfulness: number;
  faithfulness_reason: string;
  answer_relevancy: number;
  answer_relevancy_reason: string;
  latency_ms: number;
  error?: string;
};

// ── Judge helper ───────────────────────────────────────────────────────────

const JUDGE_TIMEOUT_MS = 15_000;

async function callJudge(
  prompt: string,
  apiKey: string,
  baseUrl: string,
): Promise<JudgeScore> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // Use the faster/cheaper fallback model for judging — prompts are short
      // and qwen-turbo scores just as reliably as qwen-plus for Arabic judgment.
      model: env.llmModelFallback,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0,
      max_tokens: 256,
    }),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(
      `Judge API error: ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content ?? "";
  const cleaned = content
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

  if (!jsonMatch) throw new Error(`Judge returned non-JSON: ${content}`);

  return JSON.parse(jsonMatch[0]) as JudgeScore;
}

// ── Prompt builders ────────────────────────────────────────────────────────

function faithfulnessPrompt(
  question: string,
  answer: string,
  sources: string,
): string {
  return `انت محكم متخصص في تقييم دقة الاجابات القانونية.

مهمتك: تقييم ما اذا كانت الاجابة مبنية فعلا على النصوص القانونية المقدمة.

السؤال:
${question}

النصوص القانونية المسترجعة (المصادر):
${sources}

الاجابة المقدمة:
${answer}

قيم الاجابة وفق المعايير التالية:
- هل كل ادعاء في الاجابة مدعوم بنص صريح في المصادر؟
- هل الاجابة تتجنب اختراع معلومات غير موجودة في المصادر؟
- هل الارقام والمواد والاحكام المذكورة تتطابق مع المصادر؟

اجب بـ JSON فقط بالشكل التالي:
{"score": <رقم من 0.0 الى 1.0>, "reason": "<سبب موجز>"}

حيث:
- 1.0 = الاجابة مبنية كليا على المصادر ولا تحتوي على اي معلومات مخترعة
- 0.5 = الاجابة تحتوي على بعض المعلومات الصحيحة وبعض المعلومات غير المدعومة
- 0.0 = الاجابة تخترع معلومات او تتناقض مع المصادر`;
}

function relevancyPrompt(question: string, answer: string): string {
  return `انت محكم متخصص في تقييم جودة الاجابات القانونية.

مهمتك: تقييم ما اذا كانت الاجابة تجيب فعلا على السؤال المطروح.

السؤال:
${question}

الاجابة المقدمة:
${answer}

قيم الاجابة وفق المعايير التالية:
- هل الاجابة تعالج السؤال المطروح تحديدا؟
- هل الاجابة تقدم معلومات مفيدة وذات صلة؟
- هل الاجابة تتجنب الانحراف عن موضوع السؤال؟

اجب بـ JSON فقط بالشكل التالي:
{"score": <رقم من 0.0 الى 1.0>, "reason": "<سبب موجز>"}

حيث:
- 1.0 = الاجابة تجيب على السؤال بشكل كامل ومباشر
- 0.5 = الاجابة ذات صلة جزئيا لكنها لا تجيب بشكل كامل
- 0.0 = الاجابة لا تجيب على السؤال او تتجاهله تماما`;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function evaluate() {
  console.log("=".repeat(60));
  console.log("LegalMind Evaluation — Starting");
  console.log(`Questions:  ${questions.length}`);
  console.log(`LLM model:  ${env.llmModel}`);
  console.log(`Reranker:   ${env.llmRerankModel}`);
  console.log(`Hybrid:     ${env.enableHybridSearch}`);
  console.log(`Rewrite:    ${env.enableQueryRewrite}`);
  console.log("=".repeat(60));

  const services = createServices();
  await services.mongoService.connect();

  const apiKey = services.providerConfigService.getDashScopeApiKey();
  const baseUrl = env.dashscopeBaseUrl;

  const results: EvalResult[] = [];

  for (const q of questions as EvalQuestion[]) {
    process.stdout.write(`\n[${q.id}] ${q.query.slice(0, 55)}... `);

    const result: EvalResult = {
      id: q.id,
      query: q.query,
      category: q.category,
      answer: "",
      source_count: 0,
      faithfulness: 0,
      faithfulness_reason: "",
      answer_relevancy: 0,
      answer_relevancy_reason: "",
      latency_ms: 0,
    };

    try {
      // Step 1: Run the query through our full pipeline
      const response: QueryResponse = await services.queryService.runQuery({
        query: q.query,
        top_k: 5,
        user_role: "citizen",
      });

      result.answer = response.answer;
      result.source_count = response.source_chunks.length;
      result.latency_ms = response.latency_ms;

      // Step 2: Build sources text for the faithfulness judge
      // Build Arabic-labelled source text — keeping everything in Arabic
      // prevents the judge from scoring down due to mixed-language context.
      const sourcesText = response.source_chunks
        .map(
          (c, i) =>
            `[${i + 1}] ${c.law_name_normalized?.trim() || "قانون غير محدد"} — مادة ${c.article_number ?? "غير محدد"}\n${c.content}`,
        )
        .join("\n\n");

      // Step 3: Score faithfulness (is the answer grounded in sources?)
      if (response.source_chunks.length > 0) {
        const fScore = await callJudge(
          faithfulnessPrompt(q.query, response.answer, sourcesText),
          apiKey,
          baseUrl,
        );
        result.faithfulness = fScore.score;
        result.faithfulness_reason = fScore.reason;
      } else {
        result.faithfulness = 0;
        result.faithfulness_reason =
          "لم يتم استرجاع أي مصادر من قاعدة البيانات";
      }

      // Step 4: Score answer relevancy (does the answer address the question?)
      const rScore = await callJudge(
        relevancyPrompt(q.query, response.answer),
        apiKey,
        baseUrl,
      );
      result.answer_relevancy = rScore.score;
      result.answer_relevancy_reason = rScore.reason;

      console.log(
        `OK  F=${result.faithfulness.toFixed(2)}  R=${result.answer_relevancy.toFixed(2)}  (${result.latency_ms}ms)`,
      );
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.log(`ERR  ${result.error}`);
    }

    results.push(result);

    // Delay between questions to avoid DashScope rate limits
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  // ── Summary table ─────────────────────────────────────────────────────────

  const successful = results.filter((r) => !r.error);
  const failed = results.length - successful.length;

  const avg = (arr: number[]) =>
    arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

  const avgFaithfulness = avg(successful.map((r) => r.faithfulness));
  const avgRelevancy = avg(successful.map((r) => r.answer_relevancy));
  const avgLatency = avg(successful.map((r) => r.latency_ms));

  const byCategory: Record<string, { f: number[]; r: number[] }> = {};

  for (const res of successful) {
    if (!byCategory[res.category]) byCategory[res.category] = { f: [], r: [] };
    byCategory[res.category].f.push(res.faithfulness);
    byCategory[res.category].r.push(res.answer_relevancy);
  }

  console.log("\n" + "=".repeat(60));
  console.log("EVALUATION RESULTS");
  console.log("=".repeat(60));
  console.log(`Total questions:      ${questions.length}`);
  console.log(`Successful:           ${successful.length}`);
  console.log(`Failed:               ${failed}`);
  console.log(`Avg faithfulness:     ${avgFaithfulness.toFixed(3)}`);
  console.log(`Avg answer relevancy: ${avgRelevancy.toFixed(3)}`);
  console.log(`Avg latency:          ${Math.round(avgLatency)}ms`);
  console.log("\nBy category:");

  for (const [cat, scores] of Object.entries(byCategory)) {
    const f = avg(scores.f);
    const r = avg(scores.r);
    console.log(
      `  ${cat.padEnd(22)} F=${f.toFixed(2)}  R=${r.toFixed(2)}  (n=${scores.f.length})`,
    );
  }
  console.log("=".repeat(60));

  // ── Write results to JSON ─────────────────────────────────────────────────

  const output = {
    timestamp: new Date().toISOString(),
    config: {
      llm_model: env.llmModel,
      rerank_model: env.llmRerankModel,
      enable_hybrid_search: env.enableHybridSearch,
      enable_llm_rerank: env.enableLlmRerank,
      enable_query_rewrite: env.enableQueryRewrite,
    },
    summary: {
      total: questions.length,
      successful: successful.length,
      failed,
      avg_faithfulness: avgFaithfulness,
      avg_answer_relevancy: avgRelevancy,
      avg_latency_ms: Math.round(avgLatency),
    },
    by_category: Object.fromEntries(
      Object.entries(byCategory).map(([cat, scores]) => [
        cat,
        {
          avg_faithfulness: avg(scores.f),
          avg_relevancy: avg(scores.r),
          n: scores.f.length,
        },
      ]),
    ),
    results,
  };

  // Write results to a predictable path relative to the script's directory.
  const outDir = join(__dirname, "eval_results");
  mkdirSync(outDir, { recursive: true });
  const filename = join(outDir, `eval_${Date.now()}.json`);
  writeFileSync(filename, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to: ${filename}`);

  await services.mongoService.close();
}

void evaluate();
