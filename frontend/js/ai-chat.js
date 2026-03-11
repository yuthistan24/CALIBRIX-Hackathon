import { apiFetch, formatDate, loadCurrentUser, logout, requireAuth, severityClass, showToast } from './api.js';

requireAuth('student');
document.getElementById('logout-button').addEventListener('click', logout);

const messagesContainer = document.getElementById('ai-messages');
const input = document.getElementById('ai-input');
const sendButton = document.getElementById('send-ai-message');
const copingList = document.getElementById('coping-list');
const sentimentState = document.getElementById('sentiment-state');
const voiceInputButton = document.getElementById('voice-input-button');
const voiceOutputButton = document.getElementById('voice-output-button');
const voiceStatus = document.getElementById('voice-status');

let currentUser;
let lastAiReply = '';
let recognition;
let listening = false;

function renderBubble(message, isUser) {
  const bubble = document.createElement('div');
  bubble.className = `bubble ${isUser ? 'user' : 'peer'}`;
  bubble.innerHTML = `<div>${message.message}</div><div class="small muted">${formatDate(message.createdAt || new Date())}</div>`;
  messagesContainer.appendChild(bubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function loadHistory() {
  currentUser = await loadCurrentUser();
  const roomId = encodeURIComponent(`ai:${currentUser._id}`);
  const history = await apiFetch(`/api/chat/rooms/${roomId}/messages`);
  messagesContainer.innerHTML = '';
  history.messages.forEach((message) => renderBubble(message, message.senderRole === 'student'));
}

function renderStrategies(strategies = []) {
  copingList.innerHTML = strategies
    .map((strategy) => `<div class="list-item"><p>${strategy}</p></div>`)
    .join('');
}

async function sendMessage() {
  const message = input.value.trim();
  if (!message) {
    return;
  }

  input.value = '';
  renderBubble({ message, createdAt: new Date() }, true);

  try {
    const result = await apiFetch('/api/students/ai-chat', {
      method: 'POST',
      body: { message }
    });
    renderBubble({ message: result.chat.reply, createdAt: new Date() }, false);
    renderStrategies(result.chat.copingStrategies);
    lastAiReply = result.chat.reply;
    sentimentState.textContent = `${result.sentiment.label} sentiment detected. Stress indicator ${result.sentiment.stressIndicator}.`;
    sentimentState.className = `section-copy ${severityClass(result.chat.escalate ? 'high' : result.sentiment.label)}`;
    if (result.chat.escalate) {
      showToast('High distress detected. A mental health alert may have been raised.', 'error');
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

sendButton.addEventListener('click', sendMessage);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendMessage();
  }
});

function setupVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceStatus.textContent = 'Speech recognition is not supported in this browser.';
    voiceInputButton.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;

  recognition.onstart = () => {
    listening = true;
    voiceStatus.textContent = 'Listening...';
    voiceInputButton.textContent = 'Listening';
  };

  recognition.onend = () => {
    listening = false;
    voiceStatus.textContent = 'Voice input stopped.';
    voiceInputButton.textContent = 'Start Voice Input';
  };

  recognition.onresult = (event) => {
    input.value = event.results[0][0].transcript;
    voiceStatus.textContent = 'Transcript captured. Ready to send.';
  };

  voiceInputButton.addEventListener('click', () => {
    if (listening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });

  voiceOutputButton.addEventListener('click', () => {
    if (!lastAiReply) {
      showToast('No AI reply available yet');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(lastAiReply);
    window.speechSynthesis.speak(utterance);
  });
}

setupVoice();
loadHistory().catch((error) => showToast(error.message, 'error'));
