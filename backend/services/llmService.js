const axios = require('axios');

const env = require('../config/env');
const { formatGuidanceForPrompt, retrieveRelevantGuidance } = require('./psychologyKnowledgeService');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    copingStrategies: {
      type: 'array',
      items: { type: 'string' },
      minItems: 0,
      maxItems: 4
    },
    topic: { type: 'string' },
    escalate: { type: 'boolean' },
    alertSeverity: {
      type: 'string',
      enum: ['low', 'moderate', 'high']
    },
    escalationReason: { type: 'string' },
    followUpQuestion: { type: 'string' }
  },
  required: ['reply', 'copingStrategies', 'topic', 'escalate', 'alertSeverity', 'escalationReason', 'followUpQuestion'],
  additionalProperties: false
};

const TRANSCRIPT_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    needs: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 6
    },
    urgency: {
      type: 'string',
      enum: ['low', 'moderate', 'high']
    },
    summary: { type: 'string' }
  },
  required: ['needs', 'urgency', 'summary'],
  additionalProperties: false
};

function buildSystemPrompt(language = 'English') {
  return [
    'You are MindGuard, a supportive educational and mental-health mentor for students.',
    'Respond with warmth, clarity, and practical next steps.',
    'Do not sound robotic or repetitive.',
    'If asked the same thing again, vary your wording and examples while staying consistent.',
    'Do not reply with only empathy or only a question. Always include actionable steps.',
    "Address the user as 'you'. Do not refer to 'the student'.",
    "Avoid first-person filler (like \"I'm here\"). Speak directly to the user.",
    "Do not repeat the user's message verbatim; respond with new information and steps.",
    'Do not invent personal details or backstory; base your response only on what the user wrote.',
    'Only suggest breathing/grounding if the user expresses stress, panic, or strong emotion.',
    'Keep the reply concise but not generic.',
    'If the student sounds unsafe, overwhelmed, or close to giving up, set escalate to true.',
    'Use the supplied psychological guidance notes when they are relevant.',
    'Do not diagnose. Prioritize safety and counselor escalation when risk is high.',
    `Write the reply in ${language}.`,
    'In reply, include 2-4 short actionable steps and 1 clarifying question.',
    'Return structured JSON only.'
  ].join(' ');
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

function getSamplingConfig() {
  return {
    temperature: clampNumber(env.llm?.temperature, 0, 2, 0.75),
    topP: clampNumber(env.llm?.topP, 0, 1, 0.9)
  };
}

function getChatTimeoutMs() {
  return clampNumber(env.llm?.chatTimeoutMs, 5000, 120000, 25000);
}

function buildConversationInput({ message, chatHistory = [], studentContext = {} }) {
  const guidanceBlock = formatGuidanceForPrompt(
    retrieveRelevantGuidance({
      message,
      studentContext
    })
  );
  const maxTurns = Math.max(0, Math.min(40, Number(env.llm?.chatHistoryTurns || 8)));
  const historyBlock = chatHistory
    .slice(-maxTurns)
    .map((entry) => `${entry.role === 'assistant' ? 'Assistant' : 'You'}: ${entry.message}`)
    .join('\n');

  return [
    'User profile and recent context:',
    JSON.stringify(studentContext),
    '',
    'Relevant psychological guidance:',
    guidanceBlock,
    '',
    'Recent conversation:',
    historyBlock || 'No recent conversation.',
    '',
    `Latest message from you: ${message}`,
    '',
    'Return JSON with:',
    '- reply: the assistant response',
    '- copingStrategies: 2 to 4 short practical steps',
    '- topic: the main concern',
    '- escalate: boolean',
    '- alertSeverity: low, moderate, or high',
    '- escalationReason: short explanation',
    '- followUpQuestion: one short follow-up question'
  ].join('\n');
}

function buildTranscriptInput({ transcript, language = 'English' }) {
  const guidanceBlock = formatGuidanceForPrompt(
    retrieveRelevantGuidance({
      message: transcript,
      studentContext: {}
    })
  );

  return [
    `Analyze this student self-introduction transcript in ${language}.`,
    'Identify the main support needs, summarize the case briefly, and estimate urgency.',
    '',
    'Relevant psychological guidance:',
    guidanceBlock,
    '',
    `Transcript: ${transcript}`,
    '',
    'Return JSON with:',
    '- needs: 1 to 6 short support themes',
    '- urgency: low, moderate, or high',
    '- summary: a short actionable summary'
  ].join('\n');
}

function extractJsonCandidate(text = '') {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return '';
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function safeJsonParse(text = '') {
  try {
    return JSON.parse(extractJsonCandidate(text));
  } catch (_error) {
    return null;
  }
}

function isGreetingMessage(message = '') {
  const normalized = String(message || '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const shortGreetings = new Set(['hi', 'hello', 'hey', 'hii', 'hiii', 'yo', 'sup']);
  if (shortGreetings.has(normalized)) {
    return true;
  }

  if (normalized.length <= 18 && /(good\s+morning|good\s+evening|good\s+afternoon|howdy)\b/.test(normalized)) {
    return true;
  }

  return normalized.length <= 6 && /^[a-z]+$/.test(normalized);
}

function looksOffTopicFollowUp(question = '') {
  const lowered = String(question || '').toLowerCase();
  if (!lowered) {
    return true;
  }
  return (
    lowered.includes('the student') ||
    lowered.includes('their journey') ||
    lowered.includes('community') ||
    lowered.includes('we support') ||
    lowered.includes('towards finding')
  );
}

function normalizeReply(payload = {}, defaults = {}, context = {}) {
  const userMessage = String(context.message || '').trim();
  const normalized = {
    reply: String(payload.reply || defaults.reply || '').trim(),
    copingStrategies: Array.isArray(payload.copingStrategies)
      ? payload.copingStrategies.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
      : defaults.copingStrategies || [],
    topic: String(payload.topic || defaults.topic || 'support').trim(),
    escalate: Boolean(payload.escalate ?? defaults.escalate),
    alertSeverity: ['low', 'moderate', 'high'].includes(payload.alertSeverity)
      ? payload.alertSeverity
      : defaults.alertSeverity || 'low',
    escalationReason: String(payload.escalationReason || defaults.escalationReason || '').trim(),
    followUpQuestion: String(payload.followUpQuestion || defaults.followUpQuestion || '').trim(),
    source: defaults.source || 'llm',
    provider: defaults.provider || env.llm.provider,
    model: defaults.model || 'unknown'
  };

  const greetingMode = isGreetingMessage(userMessage);

  if (
    /\bthe student\b/i.test(normalized.followUpQuestion) ||
    /\bstudent\b/i.test(normalized.followUpQuestion) ||
    (greetingMode && looksOffTopicFollowUp(normalized.followUpQuestion))
  ) {
    normalized.followUpQuestion = greetingMode
      ? 'What would you like help with right now?'
      : 'Which part feels hardest right now (thoughts, body stress, or the situation)?';
  }

  if (normalized.copingStrategies.length < 2) {
    const fallbackStrategies = greetingMode
      ? [
          'In one sentence, tell me what you want help with (stress, studies, loneliness, sleep, motivation).',
          "If it’s easier, pick one word: overwhelmed / lonely / anxious / unfocused / tired.",
          'If you want a tiny start: take 3 slow breaths and relax your shoulders.'
        ]
      : [
          'Take 3 slow breaths and unclench your shoulders.',
          'Write down the next smallest step you can do in 10 minutes.',
          'Message one trusted person with a simple check-in.'
        ];
    for (const entry of fallbackStrategies) {
      if (normalized.copingStrategies.length >= 2) {
        break;
      }
      if (!normalized.copingStrategies.includes(entry)) {
        normalized.copingStrategies.push(entry);
      }
    }
    normalized.copingStrategies = normalized.copingStrategies.slice(0, 4);
  }

  if (greetingMode) {
    normalized.copingStrategies = [
      'In one sentence, tell me what you want help with (stress, studies, loneliness, sleep, motivation).',
      'Pick a starting area: stress / studies / loneliness / sleep / motivation.',
      'Rate it from 1 to 10 right now.'
    ];
  }

  if (!normalized.followUpQuestion) {
    normalized.followUpQuestion = greetingMode
      ? 'What would you like help with right now?'
      : 'Which part feels hardest right now (thoughts, body stress, or the situation)?';
  }

  if (greetingMode) {
    const steps = normalized.copingStrategies
      .slice(0, 3)
      .map((step, index) => `${index + 1}) ${step}`)
      .join(' ');
    normalized.reply = `Hi. ${steps} Question: ${normalized.followUpQuestion}`.trim();
    return normalized;
  }

  if (!normalized.reply) {
    normalized.reply = [normalized.copingStrategies.slice(0, 2).join(' '), normalized.followUpQuestion]
      .filter(Boolean)
      .join(' ')
      .trim();
  } else {
    const hasActionList = /\b1\)\s|\bTry:\s/i.test(normalized.reply);
    if (!hasActionList && normalized.copingStrategies.length) {
      const steps = normalized.copingStrategies
        .slice(0, 3)
        .map((step, index) => `${index + 1}) ${step}`)
        .join(' ');
      normalized.reply = `${normalized.reply} Try: ${steps} Question: ${normalized.followUpQuestion}`.trim();
    } else if (!/Question:\s/i.test(normalized.reply) && normalized.followUpQuestion) {
      normalized.reply = `${normalized.reply} Question: ${normalized.followUpQuestion}`.trim();
    }
  }

  return normalized;
}

function normalizeTranscriptAnalysis(payload = {}, defaults = {}) {
  return {
    needs: Array.isArray(payload.needs)
      ? payload.needs.map((item) => String(item).trim()).filter(Boolean).slice(0, 6)
      : defaults.needs || [],
    urgency: ['low', 'moderate', 'high'].includes(payload.urgency)
      ? payload.urgency
      : defaults.urgency || 'low',
    summary: String(payload.summary || defaults.summary || '').trim(),
    source: defaults.source || 'llm',
    provider: defaults.provider || env.llm.provider,
    model: defaults.model || 'unknown'
  };
}

function extractOpenAiOutputText(responseData = {}) {
  if (responseData.output_text) {
    return responseData.output_text;
  }

  return (responseData.output || [])
    .flatMap((item) => item.content || [])
    .map((entry) => entry.text || entry.output_text || '')
    .join('\n')
    .trim();
}

function extractChatCompletionText(responseData = {}) {
  return String(responseData?.choices?.[0]?.message?.content || '').trim();
}

async function fetchOllamaModels() {
  const response = await axios.get(`${env.llm.ollamaBaseUrl}/api/tags`, { timeout: 4000 });
  return Array.isArray(response.data?.models) ? response.data.models : [];
}

async function resolveOllamaModel() {
  const models = await fetchOllamaModels();
  if (!models.length) {
    return {
      modelName: '',
      fallbackUsed: false,
      installedModels: []
    };
  }

  const configured = models.find((entry) => entry.name === env.llm.ollamaModel || entry.model === env.llm.ollamaModel);
  if (configured) {
    return {
      modelName: configured.name || configured.model || env.llm.ollamaModel,
      fallbackUsed: false,
      installedModels: models.map((entry) => entry.name || entry.model).filter(Boolean)
    };
  }

  const firstAvailable = models[0];
  return {
    modelName: firstAvailable.name || firstAvailable.model || '',
    fallbackUsed: true,
    installedModels: models.map((entry) => entry.name || entry.model).filter(Boolean)
  };
}

async function generateOpenAiReply(payload) {
  if (!env.llm.openaiApiKey) {
    return null;
  }

  const sampling = getSamplingConfig();
  const response = await axios.post(
    `${env.llm.openaiBaseUrl}/responses`,
    {
      model: env.llm.openaiModel,
      instructions: buildSystemPrompt(payload.language),
      input: buildConversationInput(payload),
      temperature: sampling.temperature,
      top_p: sampling.topP,
      max_output_tokens: 500,
      text: {
        format: {
          type: 'json_schema',
          name: 'mindguard_support_response',
          schema: RESPONSE_SCHEMA,
          strict: true
        }
      }
    },
    {
      timeout: getChatTimeoutMs(),
      headers: {
        Authorization: `Bearer ${env.llm.openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const parsed = safeJsonParse(extractOpenAiOutputText(response.data));
  if (!parsed) {
    return null;
  }

  return normalizeReply(
    parsed,
    {
      source: 'llm',
      provider: 'openai',
      model: env.llm.openaiModel
    },
    { message: payload.message }
  );
}

async function analyzeOpenAiTranscript(payload) {
  if (!env.llm.openaiApiKey) {
    return null;
  }

  const response = await axios.post(
    `${env.llm.openaiBaseUrl}/responses`,
    {
      model: env.llm.openaiModel,
      instructions:
        'You analyze student self-introduction transcripts for support planning. Do not diagnose. Return JSON only.',
      input: buildTranscriptInput(payload),
      max_output_tokens: 350,
      text: {
        format: {
          type: 'json_schema',
          name: 'mindguard_transcript_analysis',
          schema: TRANSCRIPT_ANALYSIS_SCHEMA,
          strict: true
        }
      }
    },
    {
      timeout: 18000,
      headers: {
        Authorization: `Bearer ${env.llm.openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const parsed = safeJsonParse(extractOpenAiOutputText(response.data));
  if (!parsed) {
    return null;
  }

  return normalizeTranscriptAnalysis(parsed, {
    source: 'llm',
    provider: 'openai',
    model: env.llm.openaiModel
  });
}

async function generateCompatibleReply(payload) {
  if (!env.llm.compatibleApiKey || !env.llm.compatibleBaseUrl || !env.llm.compatibleModel) {
    return null;
  }

  const sampling = getSamplingConfig();
  const response = await axios.post(
    `${env.llm.compatibleBaseUrl.replace(/\/$/, '')}/chat/completions`,
    {
      model: env.llm.compatibleModel,
      response_format: { type: 'json_object' },
      temperature: sampling.temperature,
      top_p: sampling.topP,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(payload.language)
        },
        {
          role: 'user',
          content: buildConversationInput(payload)
        }
      ]
    },
    {
      timeout: getChatTimeoutMs(),
      headers: {
        Authorization: `Bearer ${env.llm.compatibleApiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const parsed = safeJsonParse(extractChatCompletionText(response.data));
  if (!parsed) {
    return null;
  }

  return normalizeReply(
    parsed,
    {
      source: 'llm',
      provider: 'compatible',
      model: env.llm.compatibleModel
    },
    { message: payload.message }
  );
}

async function analyzeCompatibleTranscript(payload) {
  if (!env.llm.compatibleApiKey || !env.llm.compatibleBaseUrl || !env.llm.compatibleModel) {
    return null;
  }

  const response = await axios.post(
    `${env.llm.compatibleBaseUrl.replace(/\/$/, '')}/chat/completions`,
    {
      model: env.llm.compatibleModel,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You analyze student self-introduction transcripts for support planning. Do not diagnose. Return JSON only.'
        },
        {
          role: 'user',
          content: buildTranscriptInput(payload)
        }
      ]
    },
    {
      timeout: 18000,
      headers: {
        Authorization: `Bearer ${env.llm.compatibleApiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const parsed = safeJsonParse(extractChatCompletionText(response.data));
  if (!parsed) {
    return null;
  }

  return normalizeTranscriptAnalysis(parsed, {
    source: 'llm',
    provider: 'compatible',
    model: env.llm.compatibleModel
  });
}

async function generateOllamaReply(payload) {
  const resolved = await resolveOllamaModel();
  if (!resolved.modelName) {
    return null;
  }

  const sampling = getSamplingConfig();
  const messages = [
    {
      role: 'system',
      content: `${buildSystemPrompt(payload.language)} Follow the requested JSON schema exactly.`
    },
    {
      role: 'user',
      content: buildConversationInput(payload)
    }
  ];

  const response = await axios.post(
    `${env.llm.ollamaBaseUrl}/api/chat`,
    {
      model: resolved.modelName,
      format: 'json',
      keep_alive: '30m',
      stream: false,
      options: {
        temperature: sampling.temperature,
        top_p: sampling.topP
      },
      messages
    },
    {
      timeout: getChatTimeoutMs()
    }
  );

  const content = response.data?.message?.content || '';
  const parsed = safeJsonParse(content);
  if (!parsed) {
    return normalizeReply(
      {
        reply: content,
        copingStrategies: [],
        topic: 'support',
        escalate: false,
        alertSeverity: 'low',
        escalationReason: '',
        followUpQuestion: ''
      },
      {
        source: 'llm',
        provider: 'ollama',
        model: resolved.modelName
      },
      { message: payload.message }
    );
  }

  return normalizeReply(
    parsed,
    {
      source: 'llm',
      provider: 'ollama',
      model: resolved.modelName
    },
    { message: payload.message }
  );
}

async function analyzeOllamaTranscript(payload) {
  const resolved = await resolveOllamaModel();
  if (!resolved.modelName) {
    return null;
  }

  const response = await axios.post(
    `${env.llm.ollamaBaseUrl}/api/chat`,
    {
      model: resolved.modelName,
      format: 'json',
      keep_alive: '30m',
      stream: false,
      messages: [
        {
          role: 'system',
          content:
            'You analyze student self-introduction transcripts for support planning. Do not diagnose. Return strict JSON only.'
        },
        {
          role: 'user',
          content: buildTranscriptInput(payload)
        }
      ]
    },
    {
      timeout: 120000
    }
  );

  const parsed = safeJsonParse(response.data?.message?.content || '');
  if (!parsed) {
    return null;
  }

  return normalizeTranscriptAnalysis(parsed, {
    source: 'llm',
    provider: 'ollama',
    model: resolved.modelName
  });
}

async function generateMentorReply(payload) {
  const providerOrder = [];
  if (env.llm.provider) {
    providerOrder.push(env.llm.provider);
  }
  for (const candidate of ['openai', 'compatible', 'ollama']) {
    if (!providerOrder.includes(candidate)) {
      providerOrder.push(candidate);
    }
  }

  for (const provider of providerOrder) {
    try {
      if (provider === 'openai') {
        const reply = await generateOpenAiReply(payload);
        if (reply) {
          return reply;
        }
      }

      if (provider === 'compatible') {
        const reply = await generateCompatibleReply(payload);
        if (reply) {
          return reply;
        }
      }

      if (provider === 'ollama') {
        const reply = await generateOllamaReply(payload);
        if (reply) {
          return reply;
        }
      }
    } catch (_error) {
      // Try the next provider in the chain.
    }
  }

  return null;
}

async function analyzeTranscriptWithLlm(payload) {
  const providerOrder = [];
  if (env.llm.provider) {
    providerOrder.push(env.llm.provider);
  }
  for (const candidate of ['openai', 'compatible', 'ollama']) {
    if (!providerOrder.includes(candidate)) {
      providerOrder.push(candidate);
    }
  }

  for (const provider of providerOrder) {
    try {
      if (provider === 'openai') {
        const result = await analyzeOpenAiTranscript(payload);
        if (result) {
          return result;
        }
      }

      if (provider === 'compatible') {
        const result = await analyzeCompatibleTranscript(payload);
        if (result) {
          return result;
        }
      }

      if (provider === 'ollama') {
        const result = await analyzeOllamaTranscript(payload);
        if (result) {
          return result;
        }
      }
    } catch (_error) {
      // Try the next provider.
    }
  }

  return null;
}

async function transcribeAgainstBaseUrl(baseUrl, apiKey, { audioBase64, mimeType, filename, language, model }) {
  const binary = Buffer.from(audioBase64, 'base64');
  const formData = new FormData();
  const audioBlob = new Blob([binary], { type: mimeType });
  formData.append('file', audioBlob, filename);
  formData.append('model', model);
  formData.append('language', String(language || 'en').slice(0, 2));

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Voice transcription failed: ${response.status} ${errorBody}`.trim());
  }

  const data = await response.json();
  return {
    text: String(data.text || '').trim(),
    model
  };
}

async function transcribeSpeech({ audioBase64, mimeType = 'audio/webm', filename = 'voice-message.webm', language = 'en' }) {
  if (!audioBase64) {
    return null;
  }

  try {
    if (env.llm.openaiApiKey) {
      const result = await transcribeAgainstBaseUrl(env.llm.openaiBaseUrl, env.llm.openaiApiKey, {
        audioBase64,
        mimeType,
        filename,
        language,
        model: env.llm.openaiTranscribeModel
      });
      return {
        ...result,
        source: 'openai_transcription'
      };
    }

    if (env.llm.compatibleApiKey && env.llm.compatibleBaseUrl) {
      const result = await transcribeAgainstBaseUrl(env.llm.compatibleBaseUrl, env.llm.compatibleApiKey, {
        audioBase64,
        mimeType,
        filename,
        language,
        model: env.llm.openaiTranscribeModel
      });
      return {
        ...result,
        source: 'compatible_transcription'
      };
    }
  } catch (error) {
    throw error;
  }

  return null;
}

async function getLlmRuntimeStatus() {
  const status = {
    preferredProvider: env.llm.provider,
    providerConfigured: false,
    chatAvailable: false,
    transcriptionAvailable: false,
    provider: env.llm.provider,
    model: '',
    details: ''
  };

  if (env.llm.provider === 'openai' && env.llm.openaiApiKey) {
    status.providerConfigured = true;
    status.chatAvailable = true;
    status.transcriptionAvailable = true;
    status.provider = 'openai';
    status.model = env.llm.openaiModel;
    status.details = 'OpenAI credentials are configured.';
    return status;
  }

  if (env.llm.provider === 'compatible' && env.llm.compatibleApiKey && env.llm.compatibleBaseUrl && env.llm.compatibleModel) {
    status.providerConfigured = true;
    status.chatAvailable = true;
    status.transcriptionAvailable = true;
    status.provider = 'compatible';
    status.model = env.llm.compatibleModel;
    status.details = 'OpenAI-compatible provider credentials are configured.';
    return status;
  }

  try {
    const resolved = await resolveOllamaModel();
    status.providerConfigured = true;
    status.chatAvailable = Boolean(resolved.modelName);
    status.transcriptionAvailable = false;
    status.provider = 'ollama';
    status.model = resolved.modelName || env.llm.ollamaModel;
    status.details = resolved.modelName && !resolved.fallbackUsed
      ? 'Ollama is reachable and the configured chat model is installed.'
      : resolved.modelName
        ? `Ollama is reachable. The configured model is missing, so MindGuard will use ${resolved.modelName} instead.`
        : `Ollama is reachable, but the model ${env.llm.ollamaModel} is not installed yet.`;
    return status;
  } catch (_error) {
    status.provider = env.llm.provider || 'ollama';
    status.model = env.llm.ollamaModel;
    status.details = 'No configured hosted provider was found and Ollama is not reachable.';
    return status;
  }
}

module.exports = {
  generateMentorReply,
  analyzeTranscriptWithLlm,
  getLlmRuntimeStatus,
  transcribeSpeech
};
