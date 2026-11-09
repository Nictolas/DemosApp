'use strict';

// Read-only diagnostic for the configured Groq Free account.
// Never read/write parliamentary tables, log credentials or return model output.
// Uses the same process-local quota gate as normal parliamentary explanations.
const { resolveFreeGroqModel, isGroqConfigured } = require('./parliamentFreeAiPolicy');
const { requestFreeGroq, classifyFreeGroqError } = require('./parliamentFreeGroqBudget');

async function checkGroqFreeConnectivity({
  env = process.env,
  clientFactory,
  request = requestFreeGroq
} = {}) {
  if (!isGroqConfigured(env)) return { success: false, status: 'NOT_CONFIGURED' };

  let model;
  try {
    model = resolveFreeGroqModel(env.GROQ_MODEL);
  } catch (_) {
    return { success: false, status: 'MODEL_NOT_ALLOWED' };
  }

  try {
    // SDK is only loaded after the free-only and configuration checks pass.
    const factory = clientFactory || (apiKey => {
      const Groq = require('groq-sdk');
      return new Groq({ apiKey, maxRetries: 0, timeout: 10000 });
    });
    const client = factory(env.GROQ_API_KEY);
    // One tightly bounded provider call. The content is not included in the response.
    const completion = await request(client, {
      model,
      messages: [
        { role: 'system', content: 'Rispondi soltanto con la parola OK.' },
        { role: 'user', content: 'Verifica breve di connettivita.' }
      ],
      reasoning_effort: 'low',
      temperature: 0,
      max_completion_tokens: 512
    });
    if (!completion) return { success: false, status: 'FREE_QUOTA_UNAVAILABLE', model };
    const choice = completion.choices?.[0];
    const answer = choice?.message?.content;
    // Do not report a healthy provider from a partial, filtered, tool-driven,
    // or otherwise abnormal completion, even if it includes visible text.
    if (choice?.finish_reason !== 'stop' ||
        typeof answer !== 'string' || !answer.trim()) {
      return { success: false, status: 'EMPTY_OR_TRUNCATED', model };
    }
    // A provider returning an arbitrary non-empty refusal or unrelated text
    // has not passed the instructed connectivity challenge.
    if (!/^OK[.!]?$/i.test(answer.trim())) {
      return { success: false, status: 'UNEXPECTED_RESPONSE', model };
    }
    return { success: true, status: 'OK', model };
  } catch (error) {
    return { success: false, status: classifyFreeGroqError(error), model };
  }
}

module.exports = { checkGroqFreeConnectivity };
