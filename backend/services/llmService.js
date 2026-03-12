const axios = require('axios');

const env = require('../config/env');

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

function buildSystemPrompt(language = 'English') {
  return [
    'You are MindGuard, a supportive educational and mental-health mentor for students.',
    'Respond with warmth, clarity, and practical next steps.',
    'Do not sound robotic or repetitive.',
    'Keep the reply concise but not generic.',
    'If the student sounds unsafe, overwhelmed, or close to giving up, set escalate to true.',
    `Write the reply in ${language}.`,
    'Return structured JSON only.'
  ].join(' ');
}

function buildConversationInput({ message, chatHistory = [], studentContext = {} }) {
  const historyBlock = chatHistory
    .slice(-8)
    .map((entry) => `${entry.role === 'assistant' ? 'Assistant' : 'Student'}: ${entry.message}`)
    .join('\n');

  return [
    'Student profile and recent context:',
    JSON.stringify(studentContext),
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
  return {
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

async function generateOllamaReply(payload) {
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
      model: env.llm.ollamaModel,
      stream: false,
      messages
    },
    {
      timeout: 16000
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
        model: env.llm.ollamaModel
      }
    );
  }

  return normalizeReply(parsed, {
    source: 'llm',
    provider: 'ollama',
    model: env.llm.ollamaModel
  });
}

async function generateMentorReply(payload) {
  if (env.llm.provider === 'openai') {
    return generateOpenAiReply(payload);
  }

  if (env.llm.provider === 'ollama') {
    return generateOllamaReply(payload);
  }

  return null;
}

async function transcribeSpeech({ audioBase64, mimeType = 'audio/webm', filename = 'voice-message.webm', language = 'en' }) {
  if (!audioBase64 || !env.llm.openaiApiKey) {
    return null;
  }

  const binary = Buffer.from(audioBase64, 'base64');
  const formData = new FormData();
  const audioBlob = new Blob([binary], { type: mimeType });
  formData.append('file', audioBlob, filename);
  formData.append('model', env.llm.openaiTranscribeModel);
  formData.append('language', String(language || 'en').slice(0, 2));

  const response = await fetch(`${env.llm.openaiBaseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.llm.openaiApiKey}`
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
    source: 'openai_transcription',
    model: env.llm.openaiTranscribeModel
  };
}

module.exports = {
  generateMentorReply,
  transcribeSpeech
};
