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
    'Keep the reply concise but not generic.',
    'If the student sounds unsafe, overwhelmed, or close to giving up, set escalate to true.',
    'Use the supplied psychological guidance notes when they are relevant.',
    'Do not diagnose. Prioritize safety and counselor escalation when risk is high.',
    `Write the reply in ${language}.`,
    'Return structured JSON only.'
  ].join(' ');
}

function buildConversationInput({ message, chatHistory = [], studentContext = {} }) {
  const guidanceBlock = formatGuidanceForPrompt(
    retrieveRelevantGuidance({
      message,
      studentContext
    })
  );
  const historyBlock = chatHistory
    .slice(-8)
    .map((entry) => `${entry.role === 'assistant' ? 'Assistant' : 'Student'}: ${entry.message}`)
    .join('\n');

  return [
    'Student profile and recent context:',
    JSON.stringify(studentContext),
    '',
    'Relevant psychological guidance:',
    guidanceBlock,
    '',
    'Recent conversation:',
    historyBlock || 'No recent conversation.',
    '',
    `Latest student message: ${message}`,
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

function normalizeReply(payload = {}, defaults = {}) {
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

  if (!normalized.reply) {
    normalized.reply = [normalized.copingStrategies.slice(0, 2).join(' '), normalized.followUpQuestion]
      .filter(Boolean)
      .join(' ')
      .trim();
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

  const response = await axios.post(
    `${env.llm.openaiBaseUrl}/responses`,
    {
      model: env.llm.openaiModel,
      instructions: buildSystemPrompt(payload.language),
      input: buildConversationInput(payload),
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

  return normalizeReply(parsed, {
    source: 'llm',
    provider: 'openai',
    model: env.llm.openaiModel
  });
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

  const response = await axios.post(
    `${env.llm.compatibleBaseUrl.replace(/\/$/, '')}/chat/completions`,
    {
      model: env.llm.compatibleModel,
      response_format: { type: 'json_object' },
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

  return normalizeReply(parsed, {
    source: 'llm',
    provider: 'compatible',
    model: env.llm.compatibleModel
  });
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
      messages
    },
    {
      timeout: 120000
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
      }
    );
  }

  return normalizeReply(parsed, {
    source: 'llm',
    provider: 'ollama',
    model: resolved.modelName
  });
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
