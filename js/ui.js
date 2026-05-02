import { callGeminiAPI, generateVoterPlan, state } from './api.js';

// DOM Elements
const messagesDiv = document.getElementById('messages');
const input = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');
const apiKeyInput = document.getElementById('api-key');
const calendarDiv = document.getElementById('calendar-events');
const newsDiv = document.getElementById('news-feed');
const planGeneratorBtn = document.getElementById('plan-generator-btn');
const modalOverlay = document.getElementById('plan-modal');
const modalBody = document.getElementById('modal-body');
const closeBtn = document.getElementById('close-modal');
const langBtns = document.querySelectorAll('.lang-btn');

// Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = function() {
    micBtn.classList.add('recording');
    micBtn.setAttribute('aria-label', 'Recording in progress');
  };

  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    input.value = transcript;
    sendMessage();
  };

  recognition.onerror = function() {
    micBtn.classList.remove('recording');
    micBtn.setAttribute('aria-label', 'Start Voice Input');
  };

  recognition.onend = function() {
    micBtn.classList.remove('recording');
    micBtn.setAttribute('aria-label', 'Start Voice Input');
  };
} else {
  micBtn.style.display = 'none'; // Hide if browser doesn't support
}

// Widget Data
const phaseData = {
  default: {
    events: [
      { month: 'OCT', day: '05', title: 'Voter Registration Deadline', desc: 'Last day to register.' },
      { month: 'NOV', day: '05', title: 'General Election Day', desc: 'Polls open locally.' }
    ],
    news: [
      { source: 'Civic Center', title: 'Voter turnout expected to reach record highs.', time: '2 hours ago' },
      { source: 'Election Hub', title: 'New polling locations announced.', time: '5 hours ago' }
    ]
  },
  'voter registration': {
    events: [
      { month: 'OCT', day: '05', title: 'Registration Deadline', desc: 'Postmarked by today.' },
      { month: 'OCT', day: '10', title: 'Status Check Deadline', desc: 'Verify online.' }
    ],
    news: [
      { source: 'Local Gov', title: 'Online voter portal sees massive surge.', time: '1 hour ago' }
    ]
  }
};

// UI Functions
function updateWidgets(phaseKey) {
  const data = phaseData[phaseKey] || phaseData.default;
  
  calendarDiv.innerHTML = data.events.map(ev => \`
    <div class="event-item" role="article" aria-labelledby="ev-\${ev.day}">
      <div class="event-date">
        <span class="event-month">\${ev.month}</span>
        <span class="event-day" id="ev-\${ev.day}">\${ev.day}</span>
      </div>
      <div class="event-details">
        <h4>\${ev.title}</h4>
        <p>\${ev.desc}</p>
      </div>
    </div>
  \`).join('');

  newsDiv.innerHTML = data.news.map(n => \`
    <div class="news-item" role="article">
      <div class="news-source">⚡ \${n.source}</div>
      <div class="news-title" tabindex="0">\${n.title}</div>
      <span class="news-time">\${n.time}</span>
    </div>
  \`).join('');
}

function addMessage(role, text) {
  const div = document.createElement('div');
  div.className = 'msg ' + (role === 'user' ? 'user' : 'bot');
  div.setAttribute('role', 'log');
  
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? 'U' : '🗳️';
  avatar.setAttribute('aria-hidden', 'true');
  
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  
  let htmlText = text
    .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\\n\\n/g, '<br><br>')
    .replace(/\\n(?!\\<li\\>)/g, '<br>');
    
  if (htmlText.includes('<li>')) {
    htmlText = htmlText.replace(/(<li>.*<\\/li>)/s, '<ul>$1</ul>');
  }
  
  bubble.innerHTML = htmlText;
  
  div.appendChild(avatar);
  div.appendChild(bubble);
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = 'typing-indicator';
  div.innerHTML = '<div class="avatar">🗳️</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>';
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function hideTyping() {
  const t = document.getElementById('typing-indicator');
  if (t) t.remove();
}

async function handleAPICall(text) {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    addMessage('bot', '⚠️ Please enter your API key in the Settings widget.');
    return;
  }

  showTyping();
  state.isLoading = true;
  sendBtn.disabled = true;

  try {
    const reply = await callGeminiAPI(apiKey, text);
    hideTyping();
    addMessage('bot', reply);
  } catch (e) {
    hideTyping();
    state.history.pop(); 
    addMessage('bot', '❌ Error: ' + e.message);
  } finally {
    state.isLoading = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

export function sendMessage() {
  const text = input.value.trim();
  if (!text || state.isLoading) return;
  addMessage('user', text);
  input.value = '';
  handleAPICall(text);
}

export function askPhase(phase, btnElem) {
  if (state.isLoading) return;
  document.querySelectorAll('.phase-btn').forEach(b => b.classList.remove('active'));
  btnElem.classList.add('active');
  updateWidgets(phase);
  
  const msg = state.language === 'en' 
    ? \`Explain the "\${phase}" phase of the election process.\`
    : \`Explica la fase "\${phase}" del proceso electoral.\`;
    
  addMessage('user', (state.language === 'en' ? 'Tell me about: ' : 'Háblame de: ') + phase);
  handleAPICall(msg);
}

export function sendChip(text) {
  if (state.isLoading) return;
  addMessage('user', text);
  handleAPICall(text);
}

// Event Listeners Export Setup
window.sendMessage = sendMessage;
window.askPhase = askPhase;
window.sendChip = sendChip;

// Listeners
input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

micBtn.addEventListener('click', () => {
  if (recognition) {
    recognition.lang = state.language === 'en' ? 'en-US' : 'es-ES';
    recognition.start();
  }
});

planGeneratorBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) { alert('API Key Required'); return; }
  
  planGeneratorBtn.innerHTML = '⏳ Generating...';
  planGeneratorBtn.disabled = true;
  
  try {
    const plan = await generateVoterPlan(apiKey);
    modalBody.innerHTML = plan
      .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\\n/g, '<br>');
    if (modalBody.innerHTML.includes('<li>')) {
      modalBody.innerHTML = modalBody.innerHTML.replace(/(<li>.*<\\/li>)/s, '<ul>$1</ul>');
    }
    modalOverlay.classList.add('active');
  } catch(e) {
    alert('Error generating plan: ' + e.message);
  } finally {
    planGeneratorBtn.innerHTML = '📋 Generate Custom Voter Plan';
    planGeneratorBtn.disabled = false;
  }
});

closeBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));

langBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    langBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.language = btn.dataset.lang;
    addMessage('bot', state.language === 'en' ? "Language set to English." : "Idioma establecido a Español.");
  });
});

// Init
updateWidgets('default');
