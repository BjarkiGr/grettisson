# PRISM — AI Integration (design; implemented in Phase 4)

## Principles

- Free-tier inference only. No mandatory paid subscriptions, no automatic
  paid fallback, ever.
- Provider and model are configurable via Edge Function secrets:
  AI_PROVIDER, AI_API_BASE_URL, AI_MODEL, AI_API_KEY, AI_TIMEOUT_MS,
  AI_MAX_TOKENS (see supabase/functions/.env.example).
- Credentials live exclusively in Supabase Edge Function secrets
  (`supabase secrets set ...`). Never in Git, never in the frontend.
- The rest of PRISM keeps working when AI is unavailable: ingestion,
  classification and rule-based scoring continue; analyses simply pause.

## Provider abstraction

`supabase/functions/_shared/ai-provider.ts` defines the replaceable contract
(AiProvider, AiProviderConfig, AiProviderResult, AiErrorKind). Event analysis
logic depends only on this interface, so providers can be swapped without
rewriting the application. OpenAI-compatible chat-completions endpoints are
preferred so one HTTP implementation serves most providers.

## Candidate free-tier providers (verify current terms at configuration time)

| Provider | Free allowance (subject to change) | OpenAI-compatible |
|---|---|---|
| Groq | Free tier with per-minute/day request+token limits | Yes |
| Google Gemini API | Free tier for flash-class models | Yes (compat endpoint) |
| OpenRouter | Selected :free models, daily request caps | Yes |

Free tiers change; the choice is finalized and documented in Phase 4. If no
free provider can reliably serve the workload, the limitation is documented
and analysis pauses — a paid tier is never silently introduced.

## Failure and quota handling

- HTTP 429 -> kind rate_limited; honor Retry-After; exponential backoff via
  processing_jobs.attempts; small batches per invocation.
- Quota exhaustion -> kind quota_exhausted; mark jobs paused with reason;
  resume automatically when the allowance window resets.
- Malformed JSON -> kind invalid_response; reject; never store partial output.
- Auth errors -> do not retry blindly; surface in health-check.
- Every analysis stores provider, model, prompt_version, timestamp and
  original article references for auditability.

## Evidence standards

Prompts require the model to separate verified_fact / inference / speculation
(see AiAnalysisOutput.supporting_evidence), cite only provided articles, and
state uncertainties. The AI never produces the final risk score — scoring is
explicit arithmetic in calculate-risk (see RISK-METHODOLOGY.md).

## Phase 4 provider setup (implemented)

The OpenAI-compatible provider is implemented and deployed. Choose ONE
free-tier provider, create a free API key, and set secrets from
`projects/prism/` (the key goes ONLY into Supabase secrets — never Git,
never the frontend, never chat):

Groq (recommended: fast, reliable JSON mode, free tier).
NOTE: model availability changes — llama-3.3-70b-versatile was retired;
PRISM uses openai/gpt-oss-120b (verified via GET /openai/v1/models).
If a model 404s, list current models and update AI_MODEL via secrets set.
  Key: https://console.groq.com -> API Keys
  npx supabase secrets set AI_PROVIDER=groq AI_API_BASE_URL=https://api.groq.com/openai/v1 AI_MODEL=openai/gpt-oss-120b AI_API_KEY=<your-key> --project-ref yztwbnmaujcnpytewffz

Google Gemini (free tier):
  Key: https://aistudio.google.com -> API key
  npx supabase secrets set AI_PROVIDER=gemini AI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai AI_MODEL=gemini-2.0-flash AI_API_KEY=<your-key> --project-ref yztwbnmaujcnpytewffz

OpenRouter (free models only):
  Key: https://openrouter.ai -> Keys
  npx supabase secrets set AI_PROVIDER=openrouter AI_API_BASE_URL=https://openrouter.ai/api/v1 AI_MODEL=meta-llama/llama-3.3-70b-instruct:free AI_API_KEY=<your-key> --project-ref yztwbnmaujcnpytewffz

Then invoke analyze-events repeatedly (3 jobs per call) until analyzed=0.
Quota/rate limits pause jobs automatically; they resume after 10/60 minutes
or via POST {"resume": true}. Free tiers change — verify current terms.
