import {
  apiFetch,
  emitAnalyticsEvent,
  formatDate,
  getPreferredLanguage,
  loadCurrentUser,
  logout,
  requireAuth,
  setPreferredLanguage,
  severityClass,
  showToast
} from './api.js';
import { startStudentSessionTracking } from './activity-tracker.js';

requireAuth('student');
document.getElementById('logout-button').addEventListener('click', logout);

const LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English', locale: 'en-IN', replyLanguage: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', locale: 'hi-IN', replyLanguage: 'Hindi' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', locale: 'bn-IN', replyLanguage: 'Bengali' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', locale: 'te-IN', replyLanguage: 'Telugu' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', locale: 'mr-IN', replyLanguage: 'Marathi' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', locale: 'ta-IN', replyLanguage: 'Tamil' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو', locale: 'ur-IN', replyLanguage: 'Urdu' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી', locale: 'gu-IN', replyLanguage: 'Gujarati' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', locale: 'kn-IN', replyLanguage: 'Kannada' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം', locale: 'ml-IN', replyLanguage: 'Malayalam' },
  { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', locale: 'pa-IN', replyLanguage: 'Punjabi' },
  { code: 'or', label: 'Odia', nativeLabel: 'ଓଡ଼ିଆ', locale: 'or-IN', replyLanguage: 'Odia' }
];

const QUICK_PROMPTS = [
  'I feel overwhelmed by studies and deadlines.',
  'I am losing motivation and feel like giving up.',
  'Help me calm down before I start studying.',
  'I need a small study plan for today.',
  'I feel alone and disconnected from others.'
];

const DEFAULT_COPY = {
  languageLabel: 'Language',
  assignedMentor: 'Assigned Mentor',
  voiceIntroduction: 'Voice Introduction'
};

const messagesContainer = document.getElementById('ai-messages');
const input = document.getElementById('ai-input');
const sendButton = document.getElementById('send-ai-message');
const copingList = document.getElementById('coping-list');
const sentimentState = document.getElementById('sentiment-state');
const voiceInputButton = document.getElementById('voice-input-button');
const voiceStopButton = document.getElementById('voice-stop-button');
const voiceOutputButton = document.getElementById('voice-output-button');
const voiceStatus = document.getElementById('voice-status');
const voicePreview = document.getElementById('voice-preview');
const chatDraftPreview = document.getElementById('chat-draft-preview');
const autoReadToggle = document.getElementById('auto-read-toggle');
const languageSelector = document.getElementById('language-selector');
const mentorPanel = document.getElementById('mentor-panel');
const modelSource = document.getElementById('model-source');
const topicPill = document.getElementById('topic-pill');
const typingIndicator = document.getElementById('typing-indicator');
const clearChatButton = document.getElementById('clear-chat-button');
const introRecordButton = document.getElementById('intro-record-button');
const introStopButton = document.getElementById('intro-stop-button');
const introAnalyzeButton = document.getElementById('intro-analyze-button');
const introClearButton = document.getElementById('intro-clear-button');
const introStatus = document.getElementById('intro-status');
const introTimer = document.getElementById('intro-timer');
const introTranscript = document.getElementById('intro-transcript');
const introAudio = document.getElementById('intro-audio');
const introAnalysis = document.getElementById('intro-analysis');
const quickPromptGrid = document.getElementById('quick-prompt-grid');

let currentUser;
let supportCopy = { ...DEFAULT_COPY };
let lastAiReply = '';
let lastAiModel = '';
let sendingMessage = false;

let chatVoiceRecognition = null;
let chatVoiceRecording = false;
let chatVoiceRecorder = null;
let chatVoiceStream = null;
let chatVoiceChunks = [];
let chatVoiceFinalTranscript = '';
let chatVoiceInterimTranscript = '';

let introRecognition = null;
let introRecording = false;
let introTimerId = null;
let introStopTimeoutId = null;
let introStartedAt = 0;
let introDurationSeconds = 0;
let introFinalTranscript = '';
let introInterimTranscript = '';
let introRecorder = null;
let introStream = null;
let introChunks = [];
let introAudioUrl = '';
let stopTracking = null;
let aiRuntime = null;

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getLanguageConfig(code = getPreferredLanguage()) {
  return LANGUAGES.find((language) => language.code === code) || LANGUAGES[0];
}

function formatTimer(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function updateIntroTimer(seconds = introDurationSeconds) {
  introTimer.textContent = `${formatTimer(seconds)} / 03:00`;
}

function updateModelSource(source = 'idle', model = '', provider = '') {
  const labels = {
    idle: 'LLM standby',
    llm: model ? `${provider || 'Live LLM'} · ${model}` : 'Live LLM',
    ai_service: 'AI service fallback',
    heuristic: 'Local fallback',
    unavailable: model ? `${provider || 'LLM'} unavailable · ${model}` : 'LLM unavailable'
  };
  modelSource.textContent = labels[source] || labels.idle;
}

function setTyping(active, text = 'Assistant is thinking...') {
  typingIndicator.hidden = !active;
  typingIndicator.textContent = text;
}

function buildMessageRow({ message, createdAt, senderLabel }, isUser) {
  const row = document.createElement('div');
  row.className = `message-row ${isUser ? 'user' : 'assistant'}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = isUser ? 'You' : 'AI';

  const bubble = document.createElement('div');
  bubble.className = `bubble ${isUser ? 'user' : 'peer'}`;

  const role = document.createElement('div');
  role.className = 'bubble-role';
  role.textContent = senderLabel;

  const body = document.createElement('div');
  body.textContent = message;

  const meta = document.createElement('div');
  meta.className = 'small muted';
  meta.textContent = formatDate(createdAt || new Date());

  bubble.append(role, body, meta);

  if (isUser) {
    row.append(bubble, avatar);
  } else {
    row.append(avatar, bubble);
  }

  return row;
}

function renderBubble(message, isUser) {
  const row = buildMessageRow(
    {
      message: message.message,
      createdAt: message.createdAt,
      senderLabel: isUser ? 'You' : message.senderLabel || 'MindGuard'
    },
    isUser
  );

  messagesContainer.appendChild(row);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function renderWelcomeState() {
  if (messagesContainer.childElementCount) {
    return;
  }

  renderBubble(
    {
      message:
        'Tell me what feels hardest right now. I can help with stress, deadlines, motivation, isolation, sleep, and the next concrete action to take.',
      senderLabel: 'MindGuard'
    },
    false
  );
}

function renderStrategies(strategies = [], followUpQuestion = '') {
  copingList.innerHTML = '';
  const entries = [...strategies];
  if (followUpQuestion) {
    entries.push(`Follow-up: ${followUpQuestion}`);
  }

  if (!entries.length) {
    copingList.innerHTML = '<div class="list-item"><p>No coping steps yet. Send a message to get recommendations.</p></div>';
    return;
  }

  entries.forEach((strategy) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    const text = document.createElement('p');
    text.textContent = strategy;
    item.appendChild(text);
    copingList.appendChild(item);
  });
}

function renderMentor(mentorCounselor) {
  if (!mentorCounselor) {
    mentorPanel.innerHTML =
      '<div class="list-item"><p>No counsellor is assigned yet. Book a session from the dashboard to unlock mentor contact here.</p></div>';
    return;
  }

  const phoneValue = mentorCounselor.mobileNumber || '';
  const chatUrl = `/counselor-chat.html?studentId=${encodeURIComponent(currentUser._id)}&counselorId=${encodeURIComponent(
    mentorCounselor._id
  )}&roomId=${encodeURIComponent(mentorCounselor.chatRoomId)}`;

  mentorPanel.innerHTML = `
    <div class="list-item mentor-card-compact">
      <div class="profile-row">
        <img
          class="avatar"
          src="https://ui-avatars.com/api/?name=${encodeURIComponent(mentorCounselor.name)}&background=1f4e6b&color=fff"
          alt="${escapeHtml(mentorCounselor.name)}"
        />
        <div>
          <h3>${escapeHtml(mentorCounselor.name)}</h3>
          <p>${escapeHtml(mentorCounselor.specialization || 'Student wellbeing support')}</p>
          <p>${escapeHtml(mentorCounselor.mentorMessage || 'Your counsellor is available as a mentor figure.')}</p>
        </div>
      </div>
      <div class="contact-grid">
        <a class="btn-soft" href="mailto:${encodeURIComponent(mentorCounselor.email)}">Email</a>
        <a class="btn-soft" href="${phoneValue ? `tel:${encodeURIComponent(phoneValue)}` : '#'}">Call</a>
        <a class="btn" href="${chatUrl}">Chat</a>
      </div>
      <p class="small muted">${escapeHtml(mentorCounselor.email || '')}${phoneValue ? ` | ${escapeHtml(phoneValue)}` : ''}</p>
    </div>
  `;
}

function renderIntroAnalysis(profile) {
  if (!profile) {
    introAnalysis.innerHTML = '<p class="muted small">📊 Your needs analysis will appear here after you tap Analyze Needs.</p>';
    return;
  }

  const needs = Array.isArray(profile.needs) && profile.needs.length ? profile.needs : ['General support'];
  const urgencyEmoji = { low: '🟢', medium: '🟡', high: '🔴' };
  introAnalysis.innerHTML = `
    <div class="button-row">
      <span class="pill ${severityClass(profile.urgency || 'low')}">${urgencyEmoji[profile.urgency] || '🟢'} ${escapeHtml(profile.urgency || 'low')} urgency</span>
      <span class="small muted">⏱ ${formatTimer(profile.durationSeconds || 0)}</span>
    </div>
    <h3>🎯 Identified Needs</h3>
    <p>${escapeHtml(profile.summary || 'Your support needs have been analyzed from the transcript.')}</p>
    <div class="needs-tags">
      ${needs.map(need => `<span class="pill low">${escapeHtml(need)}</span>`).join(' ')}
    </div>
    <p class="small muted">📝 This analysis is saved to your profile and visible to your assigned counselor.</p>
  `;
}

function applyCopy(copy = {}) {
  supportCopy = { ...DEFAULT_COPY, ...copy };
  document.querySelector('label[for="language-selector"]').textContent = supportCopy.languageLabel;
  document.getElementById('mentor-title').textContent = supportCopy.assignedMentor;
  document.getElementById('intro-title').textContent = supportCopy.voiceIntroduction;
}

function populateLanguageSelector() {
  languageSelector.innerHTML = LANGUAGES.map(
    (language) =>
      `<option value="${language.code}">${escapeHtml(language.nativeLabel)} / ${escapeHtml(language.label)}</option>`
  ).join('');
  languageSelector.value = getLanguageConfig().code;
}

function renderQuickPrompts() {
  quickPromptGrid.innerHTML = QUICK_PROMPTS.map(
    (prompt) => `<button class="quick-prompt" type="button" data-quick-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`
  ).join('');

  quickPromptGrid.querySelectorAll('[data-quick-prompt]').forEach((button) => {
    button.addEventListener('click', () => {
      input.value = button.dataset.quickPrompt;
      input.focus();
    });
  });
}

function updateVoiceDraft(text) {
  const value = text || 'Voice transcript preview will appear here.';
  voicePreview.textContent = value;
  chatDraftPreview.textContent = text || 'No voice draft yet.';
}

async function loadHistory() {
  const roomId = encodeURIComponent(`ai:${currentUser._id}`);
  const history = await apiFetch(`/api/chat/rooms/${roomId}/messages`);
  messagesContainer.innerHTML = '';
  history.messages.forEach((message) => {
    renderBubble(
      {
        message: message.message,
        createdAt: message.createdAt,
        senderLabel: message.senderRole === 'student' ? 'You' : 'MindGuard'
      },
      message.senderRole === 'student'
    );
  });
  renderWelcomeState();
}

async function clearConversation() {
  await apiFetch('/api/students/ai-chat/history', {
    method: 'DELETE'
  });
  messagesContainer.innerHTML = '';
  renderWelcomeState();
  renderStrategies();
  lastAiReply = '';
  lastAiModel = '';
  topicPill.textContent = 'Topic: support';
  updateModelSource();
  showToast('AI chat history cleared');
}

async function loadAiRuntimeStatus() {
  const result = await apiFetch('/api/students/ai-runtime');
  aiRuntime = result.runtime || null;

  if (!aiRuntime) {
    return;
  }

  if (aiRuntime.chatAvailable) {
    updateModelSource('llm', aiRuntime.model, aiRuntime.provider);
  } else {
    updateModelSource('unavailable', aiRuntime.model, aiRuntime.provider);
  }

  if (!chatVoiceRecording) {
    const recognitionSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    const voiceTranscriptionAvailable = Boolean(aiRuntime.transcriptionAvailable);
    const voiceInputSupported = recognitionSupported || (canUseMediaRecorder() && voiceTranscriptionAvailable);

    if (!voiceInputSupported) {
      voiceStatus.textContent =
        'Voice input is unavailable (no browser speech recognition and no server transcription). Use typing instead.';
    } else if (!voiceTranscriptionAvailable && voiceStatus.textContent.includes('idle')) {
      voiceStatus.textContent = 'Voice input uses browser speech recognition. Speak clearly for best results.';
    } else if (voiceTranscriptionAvailable && voiceStatus.textContent.includes('idle')) {
      voiceStatus.textContent = 'Voice input is ready. Tap Start Voice Chat.';
    }
  }

  updateChatVoiceButtons();
}

async function loadPageContext() {
  const language = getLanguageConfig();
  const dashboard = await apiFetch(`/api/students/dashboard?lang=${language.code}`);
  applyCopy(dashboard.supportCopy || {});
  renderMentor(dashboard.mentorCounselor);

  if (!introTranscript.value && dashboard.latestIntroProfile?.transcript) {
    introTranscript.value = dashboard.latestIntroProfile.transcript;
  }

  if (dashboard.latestIntroProfile) {
    introDurationSeconds = dashboard.latestIntroProfile.durationSeconds || 0;
    updateIntroTimer(introDurationSeconds);
  }

  renderIntroAnalysis(dashboard.latestIntroProfile);
}

function createSpeechRecognition({ continuous = false } = {}) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    return null;
  }

  const recognition = new SpeechRecognition();
  const config = getLanguageConfig();
  recognition.lang = config.locale || 'en-IN';
  recognition.interimResults = true;
  recognition.continuous = continuous;
  recognition.maxAlternatives = 1;
  return recognition;
}

function speakText(text) {
  if (!text || !window.speechSynthesis) {
    return;
  }

  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  const config = getLanguageConfig();
  utterance.lang = config.locale || 'en-IN';
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find((voice) => 
    voice.lang.toLowerCase().startsWith(config.locale.slice(0, 2).toLowerCase())
  );

  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  window.speechSynthesis.speak(utterance);
}

async function sendMessage({ messageOverride = null, origin = 'text' } = {}) {
  const message = String(messageOverride ?? input.value).trim();
  if (!message || sendingMessage) {
    return;
  }

  sendingMessage = true;
  sendButton.disabled = true;
  input.value = '';
  renderBubble({ message, createdAt: new Date(), senderLabel: 'You' }, true);
  setTyping(true);
  emitAnalyticsEvent('student_ai_chat_sent', {
    language: getLanguageConfig().code,
    origin,
    length: message.length
  });

  try {
    const result = await apiFetch('/api/students/ai-chat', {
      method: 'POST',
      body: {
        message,
        language: getLanguageConfig().replyLanguage
      }
    });

    renderBubble(
      {
        message: result.chat.reply,
        createdAt: new Date(),
        senderLabel: result.chat.provider === 'openai' ? 'MindGuard · OpenAI' : 'MindGuard'
      },
      false
    );

    renderStrategies(result.chat.copingStrategies, result.chat.followUpQuestion);
    lastAiReply = result.chat.reply;
    lastAiModel = result.chat.model || '';
    topicPill.textContent = `Topic: ${result.chat.topic || 'support'}`;
    updateModelSource(result.chat.source, result.chat.model, result.chat.provider);
    sentimentState.textContent = `${result.sentiment.label} sentiment detected. Topic: ${result.chat.topic || 'support'}. Stress indicator ${result.sentiment.stressIndicator}.`;
    sentimentState.className = `section-copy ${severityClass(result.chat.escalate ? 'high' : result.sentiment.label)}`;

    emitAnalyticsEvent('student_ai_chat_reply', {
      language: getLanguageConfig().code,
      source: result.chat.source || 'unknown',
      provider: result.chat.provider || 'unknown',
      model: result.chat.model || 'unknown',
      topic: result.chat.topic || 'support',
      escalated: Boolean(result.chat.escalate)
    });

    if (result.chat.escalate) {
      showToast('High distress detected. A live alert has been raised for follow-up.', 'error');
    }

    if (origin === 'voice' && autoReadToggle.checked) {
      speakText(result.chat.reply);
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    sendingMessage = false;
    sendButton.disabled = false;
    setTyping(false);
  }
}

function updateChatVoiceButtons() {
  const recognitionSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const voiceTranscriptionAvailable = Boolean(aiRuntime?.transcriptionAvailable);
  const voiceInputSupported = recognitionSupported || (canUseMediaRecorder() && voiceTranscriptionAvailable);
  voiceInputButton.disabled = chatVoiceRecording || !voiceInputSupported;
  voiceStopButton.disabled = !chatVoiceRecording;
}

function canUseMediaRecorder() {
  return Boolean(navigator.mediaDevices?.getUserMedia && typeof MediaRecorder === 'function');
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      resolve(dataUrl.includes(',') ? dataUrl.split(',')[1] : '');
    };
    reader.onerror = () => reject(reader.error || new Error('Unable to read audio'));
    reader.readAsDataURL(blob);
  });
}

function syncChatVoiceDraft() {
  const transcript = [chatVoiceFinalTranscript, chatVoiceInterimTranscript].filter(Boolean).join(' ').trim();
  updateVoiceDraft(transcript);
  return transcript;
}

async function transcribeRecordedVoice(blob) {
  if (!aiRuntime?.transcriptionAvailable) {
    return '';
  }

  try {
    const audioBase64 = await blobToBase64(blob);
    const result = await apiFetch('/api/students/voice/transcribe', {
      method: 'POST',
      body: {
        audioBase64,
        mimeType: blob.type || 'audio/webm',
        filename: `voice-message-${Date.now()}.webm`,
        language: getLanguageConfig().locale
      }
    });
    return result.transcription?.text || '';
  } catch (error) {
    console.log('Server transcription unavailable, using browser recognition only');
    return '';
  }
}

function createChatVoiceRecognition() {
  const recognition = createSpeechRecognition({ continuous: true });
  if (!recognition) {
    return null;
  }

  recognition.onresult = (event) => {
    let finalChunk = '';
    let interimChunk = '';

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const spoken = event.results[index][0].transcript.trim();
      if (!spoken) {
        continue;
      }

      if (event.results[index].isFinal) {
        finalChunk += `${spoken} `;
      } else {
        interimChunk += `${spoken} `;
      }
    }

    if (finalChunk) {
      chatVoiceFinalTranscript = [chatVoiceFinalTranscript, finalChunk.trim()].filter(Boolean).join(' ').trim();
    }

    chatVoiceInterimTranscript = interimChunk.trim();
    syncChatVoiceDraft();
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    voiceStatus.textContent = `Speech recognition error: ${event.error}. Audio will still be used for transcription if supported.`;
  };

  recognition.onend = () => {
    chatVoiceInterimTranscript = '';
    syncChatVoiceDraft();
    if (chatVoiceRecording) {
      window.setTimeout(() => {
        try {
          recognition.start();
        } catch (_error) {
          // Ignore restart failures on browsers that auto-stop recognition.
        }
      }, 150);
    }
  };

  return recognition;
}

async function startMessageVoiceRecording() {
  if (chatVoiceRecording) {
    return;
  }

  if (introRecording) {
    showToast('Stop the self-introduction recorder before starting voice chat.');
    return;
  }

  const recognitionSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const voiceTranscriptionAvailable = Boolean(aiRuntime?.transcriptionAvailable);
  if (!recognitionSupported && !(canUseMediaRecorder() && voiceTranscriptionAvailable)) {
    showToast(
      'Voice input needs browser speech recognition (Chrome) or server transcription (configure OPENAI_API_KEY/COMPATIBLE_*).',
      'error'
    );
    voiceStatus.textContent = 'Voice input unavailable. Use typing instead.';
    updateChatVoiceButtons();
    return;
  }

  if (!canUseMediaRecorder() && !recognitionSupported) {
    showToast('Voice recording is not available in this browser.', 'error');
    return;
  }

  chatVoiceChunks = [];
  chatVoiceFinalTranscript = '';
  chatVoiceInterimTranscript = '';
  updateVoiceDraft('');

  try {
    if (canUseMediaRecorder()) {
      chatVoiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chatVoiceRecorder = new MediaRecorder(chatVoiceStream);
      chatVoiceRecorder.ondataavailable = (event) => {
        if (event.data?.size) {
          chatVoiceChunks.push(event.data);
        }
      };
      chatVoiceRecorder.start();
    }

    chatVoiceRecognition = createChatVoiceRecognition();
    if (chatVoiceRecognition) {
      chatVoiceRecognition.start();
    }

    chatVoiceRecording = true;
    updateChatVoiceButtons();
    voiceStatus.textContent = 'Recording voice message. Press Stop Recording when you are ready to send.';
    updateVoiceDraft('Listening...');
    emitAnalyticsEvent('student_voice_chat_started', {
      language: getLanguageConfig().code
    });
  } catch (error) {
    if (chatVoiceStream) {
      chatVoiceStream.getTracks().forEach((track) => track.stop());
      chatVoiceStream = null;
    }
    chatVoiceRecorder = null;
    showToast(error.message || 'Unable to access the microphone.', 'error');
  }
}

async function stopMessageVoiceRecording() {
  if (!chatVoiceRecording) {
    return;
  }

  chatVoiceRecording = false;
  updateChatVoiceButtons();
  voiceStatus.textContent = 'Stopping recording and preparing transcript...';

  if (chatVoiceRecognition) {
    try {
      chatVoiceRecognition.stop();
    } catch (_error) {
      // Ignore browser-specific stop errors.
    }
    chatVoiceRecognition = null;
  }

  const recorder = chatVoiceRecorder;
  const stream = chatVoiceStream;
  chatVoiceRecorder = null;
  chatVoiceStream = null;

  let recordedBlob = null;
  if (recorder && recorder.state !== 'inactive') {
    await new Promise((resolve) => {
      recorder.addEventListener('stop', resolve, { once: true });
      recorder.stop();
    });
  }

  if (chatVoiceChunks.length) {
    recordedBlob = new Blob(chatVoiceChunks, { type: recorder?.mimeType || 'audio/webm' });
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }

  let transcript = syncChatVoiceDraft();
  if (!transcript && recordedBlob) {
    try {
      voiceStatus.textContent = 'Transcribing recorded audio...';
      transcript = await transcribeRecordedVoice(recordedBlob);
    } catch (error) {
      voiceStatus.textContent = 'Voice transcription failed. You can type your message instead.';
      showToast(error.message, 'error');
      return;
    }
  }

  if (!transcript) {
    voiceStatus.textContent = 'No transcript was captured. Please try again or type your message.';
    updateVoiceDraft('No transcript captured.');
    return;
  }

  input.value = transcript;
  updateVoiceDraft(transcript);
  voiceStatus.textContent = 'Voice transcript captured. Sending it to the assistant...';
  emitAnalyticsEvent('student_voice_chat_transcribed', {
    language: getLanguageConfig().code,
    length: transcript.length
  });
  await sendMessage({ messageOverride: transcript, origin: 'voice' });
  voiceStatus.textContent = 'Voice message sent. You can start another recording any time.';
}

function setupMessageVoice() {
  voiceInputButton.addEventListener('click', () => {
    startMessageVoiceRecording().catch((error) => showToast(error.message, 'error'));
  });

  voiceStopButton.addEventListener('click', () => {
    stopMessageVoiceRecording().catch((error) => showToast(error.message, 'error'));
  });

  voiceOutputButton.addEventListener('click', () => {
    if (!lastAiReply) {
      showToast('No AI reply is available yet.');
      return;
    }

    speakText(lastAiReply);
    emitAnalyticsEvent('student_voice_output_played', {
      language: getLanguageConfig().code,
      model: lastAiModel || 'unknown'
    });
  });

  updateChatVoiceButtons();
}

function syncIntroTranscriptPreview() {
  introTranscript.value = [introFinalTranscript, introInterimTranscript].filter(Boolean).join(' ').trim();
}

function resetIntroMediaPreview() {
  if (introAudioUrl) {
    URL.revokeObjectURL(introAudioUrl);
    introAudioUrl = '';
  }

  introAudio.hidden = true;
  introAudio.removeAttribute('src');
  introAudio.load();
}

function createIntroRecognition() {
  const recognition = createSpeechRecognition({ continuous: true });
  if (!recognition) {
    return null;
  }

  recognition.onresult = (event) => {
    let finalChunk = '';
    let interimChunk = '';

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const spoken = event.results[index][0].transcript.trim();
      if (!spoken) {
        continue;
      }

      if (event.results[index].isFinal) {
        finalChunk += `${spoken} `;
      } else {
        interimChunk += `${spoken} `;
      }
    }

    if (finalChunk) {
      introFinalTranscript = [introFinalTranscript, finalChunk.trim()].filter(Boolean).join(' ').trim();
    }

    introInterimTranscript = interimChunk.trim();
    syncIntroTranscriptPreview();
  };

  recognition.onerror = (event) => {
    console.error('Intro speech recognition error:', event.error);
    introStatus.textContent = `Speech-to-text error: ${event.error}. You can still edit the transcript manually.`;
  };

  recognition.onend = () => {
    introInterimTranscript = '';
    syncIntroTranscriptPreview();
    if (introRecording) {
      window.setTimeout(() => {
        try {
          recognition.start();
        } catch (_error) {
          // Ignore restart failures while recording continues.
        }
      }, 150);
    }
  };

  return recognition;
}

function updateIntroButtons() {
  introRecordButton.disabled = introRecording;
  introStopButton.disabled = !introRecording;
}

async function transcribeSelfIntroductionIfNeeded() {
  if (introTranscript.value.trim() || !introChunks.length) {
    return;
  }

  const blob = new Blob(introChunks, { type: introRecorder?.mimeType || 'audio/webm' });
  try {
    introStatus.textContent = 'Transcribing your self-introduction...';
    const audioBase64 = await blobToBase64(blob);
    const result = await apiFetch('/api/students/voice/transcribe', {
      method: 'POST',
      body: {
        audioBase64,
        mimeType: blob.type || 'audio/webm',
        filename: `intro-${Date.now()}.webm`,
        language: getLanguageConfig().locale
      }
    });
    const transcript = result.transcription?.text || '';
    if (transcript) {
      introTranscript.value = transcript;
      introStatus.textContent = 'Self-introduction transcript captured. Review it before analysis.';
      return;
    }
  } catch (error) {
    console.log('Server transcription unavailable, using browser recognition');
  }

  introStatus.textContent = 'Transcript captured from browser speech recognition. You can edit it before analysis.';
}

async function stopSelfIntroduction({ autoStopped = false } = {}) {
  if (!introRecording) {
    return;
  }

  introRecording = false;
  clearInterval(introTimerId);
  clearTimeout(introStopTimeoutId);
  introTimerId = null;
  introStopTimeoutId = null;
  introDurationSeconds = Math.min(180, Math.max(1, Math.round((Date.now() - introStartedAt) / 1000)));
  updateIntroTimer(introDurationSeconds);

  if (introRecognition) {
    try {
      introRecognition.stop();
    } catch (_error) {
      // Ignore browsers that throw if recognition is already stopping.
    }
    introRecognition = null;
  }

  const recorderToStop = introRecorder;
  const streamToStop = introStream;
  introRecorder = null;
  introStream = null;

  if (recorderToStop && recorderToStop.state !== 'inactive') {
    await new Promise((resolve) => {
      recorderToStop.addEventListener('stop', resolve, { once: true });
      recorderToStop.stop();
    });
  }

  if (streamToStop) {
    streamToStop.getTracks().forEach((track) => track.stop());
  }

  introStatus.textContent = autoStopped
    ? '✅ Recording stopped at 3 minutes. Review the transcript below and tap Analyze Needs when ready.'
    : '✅ Recording stopped. Review and edit the transcript if needed, then tap Analyze Needs.';
  updateIntroButtons();
  await transcribeSelfIntroductionIfNeeded();
  emitAnalyticsEvent('student_self_intro_stopped', {
    durationSeconds: introDurationSeconds,
    autoStopped
  });
}

async function startSelfIntroduction() {
  if (introRecording) {
    return;
  }

  if (chatVoiceRecording) {
    showToast('Stop voice chat before starting self-introduction.');
    return;
  }

  resetIntroMediaPreview();
  introChunks = [];
  introFinalTranscript = '';
  introInterimTranscript = '';
  introTranscript.value = '';
  introStartedAt = Date.now();
  introDurationSeconds = 0;
  updateIntroTimer(0);

  if (!navigator.mediaDevices?.getUserMedia) {
    introStatus.textContent = '⚠️ Audio recording not supported. You can type your introduction in the text box below.';
    showToast('Audio recording is not supported in this browser.', 'error');
    return;
  }

  try {
    introStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    introRecorder = typeof MediaRecorder === 'function' ? new MediaRecorder(introStream) : null;
    if (!introRecorder) {
      introStatus.textContent = '⚠️ Audio recording not supported. You can type your introduction manually.';
      introStream.getTracks().forEach((track) => track.stop());
      introStream = null;
      return;
    }

    const recorder = introRecorder;
    const recorderMimeType = recorder.mimeType;

    recorder.ondataavailable = (event) => {
      if (event.data?.size) {
        introChunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      if (!introChunks.length) {
        return;
      }

      const blob = new Blob(introChunks, { type: recorderMimeType || 'audio/webm' });
      introAudioUrl = URL.createObjectURL(blob);
      introAudio.src = introAudioUrl;
      introAudio.hidden = false;
    };

    introRecognition = createIntroRecognition();
    if (introRecognition) {
      introRecognition.start();
    } else {
      introStatus.textContent = '🎤 Recording... Live transcription not available. Edit the transcript manually after recording.';
    }

    recorder.start();
    introRecording = true;
    updateIntroButtons();
    introStatus.textContent = introRecognition
      ? '🔴 Recording and transcribing... Speak naturally about your challenges and feelings.'
      : '🔴 Recording audio... You can edit the transcript manually after stopping.';

    introTimerId = window.setInterval(() => {
      const elapsedSeconds = Math.min(180, Math.floor((Date.now() - introStartedAt) / 1000));
      updateIntroTimer(elapsedSeconds);
    }, 500);

    introStopTimeoutId = window.setTimeout(() => {
      stopSelfIntroduction({ autoStopped: true }).catch((error) => showToast(error.message, 'error'));
    }, 180000);

    emitAnalyticsEvent('student_self_intro_started', {
      language: getLanguageConfig().code
    });
  } catch (error) {
    introStatus.textContent = '⚠️ Microphone access denied. You can type your self-introduction manually in the text box.';
    showToast(error.message || 'Unable to access the microphone.', 'error');
  }
}

async function analyzeSelfIntroduction() {
  const transcript = introTranscript.value.trim();
  if (!transcript) {
    showToast('Record or type a self-introduction transcript before analysis.', 'error');
    return;
  }

  try {
    const result = await apiFetch('/api/students/self-introduction/analyze', {
      method: 'POST',
      body: {
        transcript,
        durationSeconds: introDurationSeconds,
        language: getLanguageConfig().replyLanguage
      }
    });

    renderIntroAnalysis(result.profile);
    emitAnalyticsEvent('student_self_intro_analyzed', {
      durationSeconds: result.profile.durationSeconds,
      urgency: result.profile.urgency
    });
    showToast('Self-introduction analyzed successfully.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function initialize() {
  currentUser = await loadCurrentUser();
  populateLanguageSelector();
  renderQuickPrompts();
  setupMessageVoice();
  updateModelSource();
  updateIntroTimer(0);
  updateVoiceDraft('');
  renderStrategies();
  
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }
  
  await Promise.all([loadHistory(), loadPageContext(), loadAiRuntimeStatus()]);
}

sendButton.addEventListener('click', () => {
  sendMessage().catch((error) => showToast(error.message, 'error'));
});

input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendMessage().catch((error) => showToast(error.message, 'error'));
  }
});

languageSelector.addEventListener('change', async () => {
  setPreferredLanguage(languageSelector.value);
  voiceStatus.textContent = `Voice input is set to ${getLanguageConfig().label}.`;
  emitAnalyticsEvent('student_language_changed', {
    language: languageSelector.value
  });
  await loadPageContext();
});

introRecordButton.addEventListener('click', () => {
  startSelfIntroduction().catch((error) => showToast(error.message, 'error'));
});

introStopButton.addEventListener('click', () => {
  stopSelfIntroduction().catch((error) => showToast(error.message, 'error'));
});

introAnalyzeButton.addEventListener('click', analyzeSelfIntroduction);

introClearButton.addEventListener('click', () => {
  if (introRecording) {
    showToast('Stop recording before clearing', 'error');
    return;
  }
  if (introTranscript.value.trim() && !confirm('Are you sure you want to clear your self-introduction? This cannot be undone.')) {
    return;
  }
  introTranscript.value = '';
  introFinalTranscript = '';
  introInterimTranscript = '';
  introDurationSeconds = 0;
  updateIntroTimer(0);
  resetIntroMediaPreview();
  renderIntroAnalysis(null);
  introStatus.textContent = '✅ Self-introduction cleared. Ready to record again.';
  showToast('Self-introduction cleared');
});

clearChatButton.addEventListener('click', () => {
  clearConversation().catch((error) => showToast(error.message, 'error'));
});

stopTracking = startStudentSessionTracking('ai-chat');
initialize().catch((error) => showToast(error.message, 'error'));
