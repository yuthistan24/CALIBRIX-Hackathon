import {
  apiFetch,
  conversationRoomId,
  formatDate,
  getApiBaseUrl,
  getToken,
  loadCurrentUser,
  logout,
  requireAuth,
  showToast
} from './api.js';

requireAuth(['student', 'counselor']);
document.getElementById('logout-button').addEventListener('click', logout);

const peerLabel = document.getElementById('chat-peer-label');
const peerPresence = document.getElementById('peer-presence');
const typingIndicator = document.getElementById('typing-indicator');
const messagesContainer = document.getElementById('room-messages');
const input = document.getElementById('room-input');
const sendButton = document.getElementById('send-room-message');

let currentUser;
let roomId;
let studentId;
let counselorId;
let peerId;
let typingTimeout;

function appendMessage(message) {
  const bubble = document.createElement('div');
  const isCurrentUser = message.senderId === currentUser._id;
  bubble.className = `bubble ${isCurrentUser ? 'user' : 'peer'}`;
  bubble.innerHTML = `<div>${message.message}</div><div class="small muted">${formatDate(message.createdAt || new Date())}</div>`;
  messagesContainer.appendChild(bubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function loadMessages() {
  const result = await apiFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages`);
  messagesContainer.innerHTML = '';
  result.messages.forEach(appendMessage);
}

async function sendMessage() {
  const message = input.value.trim();
  if (!message) {
    return;
  }

  input.value = '';
  try {
    await apiFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
      method: 'POST',
      body: {
        studentId,
        counselorId,
        recipientId: peerId,
        message
      }
    });
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function initialize() {
  currentUser = await loadCurrentUser();
  const params = new URLSearchParams(window.location.search);

  studentId = params.get('studentId') || (currentUser.role === 'student' ? currentUser._id : '');
  counselorId = params.get('counselorId') || (currentUser.role === 'counselor' ? currentUser._id : '');

  if (!studentId || !counselorId) {
    peerLabel.textContent = 'Missing chat participants in URL';
    return;
  }

  peerId = currentUser.role === 'student' ? counselorId : studentId;
  roomId = params.get('roomId') ? decodeURIComponent(params.get('roomId')) : conversationRoomId(studentId, counselorId);
  peerLabel.textContent = `Room: ${roomId}`;

  await loadMessages();

  const socketBaseUrl = getApiBaseUrl();
  const socket = socketBaseUrl
    ? window.io(socketBaseUrl, {
        auth: {
          token: getToken()
        }
      })
    : window.io({
        auth: {
          token: getToken()
        }
      });

  socket.on('connect', () => {
    socket.emit('chat:join', { roomId });
  });

  socket.on('chat:message', (message) => {
    if (message.roomId === roomId) {
      appendMessage(message);
    }
  });

  socket.on('chat:typing', ({ roomId: incomingRoomId, isTyping, userId }) => {
    if (incomingRoomId === roomId && userId !== currentUser._id) {
      typingIndicator.textContent = isTyping ? 'The other participant is typing...' : '';
    }
  });

  socket.on('presence:update', ({ userId, online }) => {
    if (userId === peerId) {
      peerPresence.textContent = online ? 'Peer is online.' : 'Peer is offline.';
    }
  });

  input.addEventListener('input', () => {
    socket.emit('chat:typing', { roomId, isTyping: true });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit('chat:typing', { roomId, isTyping: false });
    }, 900);
  });
}

sendButton.addEventListener('click', sendMessage);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendMessage();
  }
});

initialize().catch((error) => showToast(error.message, 'error'));
