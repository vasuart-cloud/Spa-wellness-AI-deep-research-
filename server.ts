import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

interface NarrateRequestBody {
  question: string;
  clarificationFocus?: string;
  personaName: string;
  personaRole: string;
  analysisMode: "fast" | "deep";
  chatbotMode?: "business-advisor" | "data-qa" | "retention-coach";
  agentProductName?: "AI Business Advisor" | "AI Retention Manager";
  toolMode?: "deep-research" | "ask" | "search";
  uploadedDoc?: {
    name: string;
    sizeLabel: string;
    excerpt: string;
  };
  computedContext: {
    title: string;
    scopeLabel: string;
    timeRange: string;
    kpis: Array<{
      label: string;
      value: string;
      baseline: string;
      variance: string;
    }>;
    anomaly?: {
      metric: string;
      actual: string;
      baseline: string;
      deviationPct: string;
      severity: string;
    };
    drivers: string[];
    actions: Array<{
      title: string;
      rationale: string;
      priority: string;
    }>;
    isStale: boolean;
    staleSourceName?: string;
    fallbackSummary: string;
    fallbackInterpretation: string;
  };
}

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Health & capability endpoint (never exposes secrets)
  app.get("/api/health", (_req, res) => {
    const hasGeminiKey = Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY" &&
        process.env.GEMINI_API_KEY.trim().length > 0
    );
    res.json({
      status: "ok",
      service: "insightflow-zenne-api",
      geminiConfigured: hasGeminiKey,
      model: "gemini-3.8-flash",
      timestamp: new Date().toISOString(),
    });
  });

  // Server-side Gemini narrative synthesis strictly grounded in deterministic analytics
  app.post("/api/advisor/narrate", async (req, res) => {
    const startedAt = Date.now();
    const body = req.body as NarrateRequestBody;

    if (!body || !body.question || !body.computedContext) {
      res.status(400).json({ error: "Missing question or computedContext payload." });
      return;
    }

    const ai = getGenAIClient();
    if (!ai) {
      res.json({
        usedGemini: false,
        reason: "GEMINI_API_KEY not configured; using certified deterministic narrative.",
        summary: body.computedContext.fallbackSummary,
        interpretation: body.computedContext.fallbackInterpretation,
        latencyMs: Date.now() - startedAt,
        usage: null,
      });
      return;
    }

    try {
      const isExecutive =
        body.personaRole.toLowerCase().includes("coo") ||
        body.personaRole.toLowerCase().includes("chief operating officer");
      const activeMode = body.chatbotMode ?? "business-advisor";
      const activeAgentName = body.agentProductName ?? "AI Business Advisor";
      const activeToolMode = body.toolMode ?? "deep-research";
      const modeGuidance =
        activeToolMode === "search"
          ? `Active Agent: ${activeAgentName} · Mode: Search. Return a crisp, direct metric and studio lookup summary in 2 sentences.`
          : activeToolMode === "ask"
            ? `Active Agent: ${activeAgentName} · Mode: Ask. Answer the user's question directly and conversationally in 2 sentences citing exact KPIs.`
            : activeAgentName === "AI Retention Manager" || activeMode === "retention-coach"
              ? "Active Agent: AI Retention Manager · Mode: Deep Research. Emphasize repeat-visit drivers, checkout rebooking gaps, overdue 45-day cohorts, cancellation churn, and holdout uplift."
              : "Active Agent: AI Business Advisor · Mode: Deep Research. Synthesize commercial performance, key operational variances, and evidence-backed priorities.";

      const systemInstruction = [
        `You are Zenne (${activeAgentName}) for Elevate Salon & Wellness Group.`,
        "CRITICAL RULE: Never invent, alter, round inaccurately, or extrapolate any numbers.",
        "Never address the user by any personal first or last name; frame insights strictly for their authorized organizational role.",
        "Use ONLY the exact figures provided in the structured computedContext JSON (and uploadedDoc excerpt if provided).",
        "Do not claim causation without evidence; refer to observed correlations and contributing operational factors.",
        body.clarificationFocus
          ? `The user responded to your follow-up question requesting focus on: "${body.clarificationFocus}". Directly address that focus using only the certified context figures.`
          : "",
        body.uploadedDoc
          ? `The user attached document "${body.uploadedDoc.name}" (${body.uploadedDoc.sizeLabel}). Cross-reference relevant notes from its excerpt against the certified warehouse metrics.`
          : "",
        modeGuidance,
        body.computedContext.isStale
          ? `WARNING: Underlying source (${body.computedContext.staleSourceName || "POS sync"}) is stale. Explicitly caution against high-stakes changes until refreshed.`
          : "Data freshness checks passed within SLA.",
        isExecutive
          ? "Adopt a concise Chief Operating Officer tone: maximum 3 crisp, high-impact sentences focused on margin, revenue-at-risk, and capital/operational prioritization."
          : "Adopt a practical Regional Manager tone: 2 to 3 clear sentences highlighting specific salons, variances against baseline, and immediate operational focus.",
      ]
        .filter(Boolean)
        .join(" ");

      const promptPayload = JSON.stringify({
        userQuestion: body.question,
        followUpClarification: body.clarificationFocus ?? null,
        signedInRole: `${body.personaName} (${body.personaRole})`,
        activeAgent: activeAgentName,
        toolMode: activeToolMode,
        uploadedDocument: body.uploadedDoc ?? null,
        scope: body.computedContext.scopeLabel,
        timeRange: body.computedContext.timeRange,
        kpis: body.computedContext.kpis,
        anomaly: body.computedContext.anomaly,
        observedDrivers: body.computedContext.drivers,
        recommendedActions: body.computedContext.actions,
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `Explain these verified analytical results clearly for the user:\n${promptPayload}`,
        config: {
          systemInstruction,
          temperature: 0.2,
          thinkingConfig: {
            thinkingLevel:
              body.analysisMode === "deep" ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW,
          },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description:
                  "Direct answer in 2 to 3 natural-language sentences strictly citing provided numbers.",
              },
              interpretation: {
                type: Type.STRING,
                description:
                  "2-sentence evidence-based interpretation of observed operational drivers without claiming unverified causation.",
              },
            },
            required: ["summary", "interpretation"],
          },
        },
      });

      const rawText = response.text?.trim();
      const parsed = rawText ? JSON.parse(rawText) : null;
      const usageMeta = response.usageMetadata;

      // Post-generation numeric guardrail: ensure every numeric token in LLM output exists in certified context
      const allowedCorpus = [
        promptPayload,
        body.computedContext.fallbackSummary,
        body.computedContext.fallbackInterpretation,
        body.question,
        body.uploadedDoc?.excerpt ?? "",
      ].join(" ");
      const extractNormalizedNumbers = (str: string): Set<string> => {
        const matches = str.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? [];
        const set = new Set<string>();
        for (const m of matches) {
          const clean = m.replace(/,/g, "");
          set.add(clean);
          const asNum = Number(clean);
          if (!Number.isNaN(asNum)) {
            set.add(String(asNum));
            set.add(asNum.toFixed(1));
          }
        }
        // Permit standard small structural counts (e.g. 1-5 sentences/steps/regions, 24h, 30d, 48h, 2026)
        ["1", "2", "3", "4", "5", "20", "24", "30", "45", "48", "60", "2026"].forEach((n) =>
          set.add(n)
        );
        return set;
      };
      const allowedNumbers = extractNormalizedNumbers(allowedCorpus);
      const isGroundedText = (candidate: unknown): candidate is string => {
        if (typeof candidate !== "string" || candidate.trim().length === 0) {
          return false;
        }
        const tokens = candidate.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? [];
        return tokens.every((tok) => {
          const clean = tok.replace(/,/g, "");
          return allowedNumbers.has(clean) || allowedNumbers.has(String(Number(clean)));
        });
      };

      const verifiedSummary = isGroundedText(parsed?.summary)
        ? parsed.summary
        : body.computedContext.fallbackSummary;
      const verifiedInterpretation = isGroundedText(parsed?.interpretation)
        ? parsed.interpretation
        : body.computedContext.fallbackInterpretation;

      res.json({
        usedGemini: true,
        model: "gemini-3.8-flash",
        summary: verifiedSummary,
        interpretation: verifiedInterpretation,
        numericGuardrailVerified: true,
        latencyMs: Date.now() - startedAt,
        usage: usageMeta
          ? {
              promptTokens: usageMeta.promptTokenCount ?? 0,
              completionTokens: usageMeta.candidatesTokenCount ?? 0,
              totalTokens: usageMeta.totalTokenCount ?? 0,
              isLiveMetadata: true,
            }
          : null,
      });
    } catch (error: unknown) {
      const errMessage =
        error instanceof Error ? error.message : "Gemini request failed";
      // Graceful fallback to deterministic narrative while surfacing telemetry status
      res.json({
        usedGemini: false,
        errorNotice: errMessage,
        summary: body.computedContext.fallbackSummary,
        interpretation: body.computedContext.fallbackInterpretation,
        latencyMs: Date.now() - startedAt,
        usage: null,
      });
    }
  });

  // Server-side Cockpit AI Assist endpoint for tough guest questions in Chat & Voice Console
  app.post("/api/cockpit/ai-assist", async (req, res) => {
    const startedAt = Date.now();
    const {
      toughQuestion,
      guestName,
      membershipTier,
      salonName,
      channel,
      appointmentSummary,
      recentTranscript,
      fallbackSuggestion,
    } = (req.body ?? {}) as {
      toughQuestion?: string;
      guestName?: string;
      membershipTier?: string;
      salonName?: string;
      channel?: string;
      appointmentSummary?: string;
      recentTranscript?: string;
      fallbackSuggestion?: {
        suggestedAnswer: string;
        keyPolicyPoints: string[];
        policyReference: string;
        recommendedActionSummary: string;
      };
    };

    if (!toughQuestion || !fallbackSuggestion) {
      res
        .status(400)
        .json({ error: "Missing toughQuestion or fallbackSuggestion payload." });
      return;
    }

    const ai = getGenAIClient();
    if (!ai) {
      res.json({
        usedGemini: false,
        suggestedAnswer: fallbackSuggestion.suggestedAnswer,
        keyPolicyPoints: fallbackSuggestion.keyPolicyPoints,
        policyReference: fallbackSuggestion.policyReference,
        recommendedActionSummary: fallbackSuggestion.recommendedActionSummary,
        latencyMs: Date.now() - startedAt,
        usage: null,
      });
      return;
    }

    try {
      const systemInstruction = [
        "You are Cockpit AI Assist for Elevate Salon & Wellness Group, helping salon managers answer tough live customer questions over Chat or Voice.",
        "Follow Elevate Guest Care & Clinical Policy strictly:",
        "1) Late Cancellation Policy (§4.2): Cancellations inside 24 hours carry a $65 fee, EXCEPT managers may grant a one-time courtesy fee waiver for documented flight/weather delays, medical emergencies, or VIP Wellness / Signature Members who reschedule within 7 days.",
        "2) 14-Day Service Satisfaction Guarantee (§3.4): Guests reporting color brassiness, uneven tone, or cut concerns within 14 days qualify for a complimentary 45-minute tonal/cut refinement with a Senior or Master Stylist; cash refunds require studio inspection first unless chemical reaction is documented.",
        "3) Prenatal & Sensitivity Safety (§2.1): Our Botanical Amino Keratin Express formula is 100% formaldehyde-free and aldehyde-free, ventilated chairside, and requires a 15-minute strand/patch check plus guest OB-GYN comfort sign-off if pregnant.",
        "4) Multi-Studio Membership Credits (§5.1): VIP Wellness & Signature Member monthly credits transfer across all 20 Elevate studios nationwide with zero transfer fee; freezes up to 60 days preserve accrued rollover credits.",
        "5) Write a warm, ready-to-send answer directly addressing the guest in 2 to 4 crisp sentences. Never use internal persona names.",
      ].join(" ");

      const contextPayload = JSON.stringify({
        guestName: guestName ?? "Valued Guest",
        membershipTier: membershipTier ?? "Standard Guest",
        salonName: salonName ?? "Elevate Studio",
        channel: channel ?? "Chat",
        linkedAppointment: appointmentSummary ?? "No active booking linked",
        recentConversationContext: recentTranscript ?? "",
        toughCustomerQuestion: toughQuestion,
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `Generate an accurate, empathetic manager response and booking action for this customer interaction:\n${contextPayload}`,
        config: {
          systemInstruction,
          temperature: 0.25,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedAnswer: {
                type: Type.STRING,
                description:
                  "Ready-to-send empathetic answer to the guest (2-4 sentences) grounded in Elevate policy.",
              },
              keyPolicyPoints: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  "2 to 3 concise policy or clinical facts for the manager.",
              },
              policyReference: {
                type: Type.STRING,
                description:
                  "Specific Elevate policy section cited, e.g. Elevate Guest Care Policy §4.2.",
              },
              recommendedActionSummary: {
                type: Type.STRING,
                description:
                  "Concrete next appointment action in 1 short phrase (reschedule, waive fee, or book refinement).",
              },
            },
            required: [
              "suggestedAnswer",
              "keyPolicyPoints",
              "policyReference",
              "recommendedActionSummary",
            ],
          },
        },
      });

      const rawText = response.text?.trim();
      const parsed = rawText ? JSON.parse(rawText) : null;
      const usageMeta = response.usageMetadata;

      res.json({
        usedGemini: true,
        model: "gemini-3.8-flash",
        suggestedAnswer:
          typeof parsed?.suggestedAnswer === "string" &&
          parsed.suggestedAnswer.trim().length > 0
            ? parsed.suggestedAnswer.trim()
            : fallbackSuggestion.suggestedAnswer,
        keyPolicyPoints:
          Array.isArray(parsed?.keyPolicyPoints) &&
          parsed.keyPolicyPoints.length > 0
            ? parsed.keyPolicyPoints.slice(0, 3)
            : fallbackSuggestion.keyPolicyPoints,
        policyReference:
          typeof parsed?.policyReference === "string" &&
          parsed.policyReference.trim().length > 0
            ? parsed.policyReference.trim()
            : fallbackSuggestion.policyReference,
        recommendedActionSummary:
          typeof parsed?.recommendedActionSummary === "string" &&
          parsed.recommendedActionSummary.trim().length > 0
            ? parsed.recommendedActionSummary.trim()
            : fallbackSuggestion.recommendedActionSummary,
        latencyMs: Date.now() - startedAt,
        usage: usageMeta
          ? {
              promptTokens: usageMeta.promptTokenCount ?? 0,
              completionTokens: usageMeta.candidatesTokenCount ?? 0,
              totalTokens: usageMeta.totalTokenCount ?? 0,
              isLiveMetadata: true,
            }
          : null,
      });
    } catch {
      res.json({
        usedGemini: false,
        suggestedAnswer: fallbackSuggestion.suggestedAnswer,
        keyPolicyPoints: fallbackSuggestion.keyPolicyPoints,
        policyReference: fallbackSuggestion.policyReference,
        recommendedActionSummary: fallbackSuggestion.recommendedActionSummary,
        latencyMs: Date.now() - startedAt,
        usage: null,
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`InsightFlow server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
