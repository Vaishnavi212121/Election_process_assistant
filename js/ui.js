"use strict";

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
const pollingPlaceDiv = document.getElementById('polling-place-widget'); // We will add this to index.html

// Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = function() {
    micBtn.classList.add('recording');
    micBtn.setAttribute('aria-pressed', 'true');
    micBtn.setAttribute('aria-label', 'Recording in progress');
  };

  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    input.value = transcript;
    sendMessage();
  };

  recognition.onerror = function() {
    micBtn.classList.remove('recording');
    micBtn.setAttribute('aria-pressed', 'false');
    micBtn.setAttribute('aria-label', 'Start Voice Input');
  };

  recognition.onend = function() {
    micBtn.classList.remove('recording');
    micBtn.setAttribute('aria-pressed', 'false');
    micBtn.setAttribute('aria-label', 'Start Voice Input');
  };
} else {
  if(micBtn) micBtn.style.display = 'none'; // Hide if browser doesn't support
}

// Widget Data
const phaseData = {
  default: {
    events: [
      { month: 'OCT', day: '05', title: 'Voter Registration Deadline', desc: 'Last day to register.', date: '20241005T000000Z' },
      { month: 'NOV', day: '05', title: 'General Election Day', desc: 'Polls open locally.', date: '20241105T120000Z' }
    ],
    news: [
      { source: 'Civic Center', title: 'Voter turnout expected to reach record highs.', time: '2 hours ago' },
      { source: 'Election Hub', title: 'New polling locations announced.', time: '5 hours ago' }
    ]
  },
  'voter registration': {
    events: [
      { month: 'OCT', day: '05', title: 'Registration Deadline', desc: 'Postmarked by today.', date: '20241005T000000Z' },
      { month: 'OCT', day: '10', title: 'Status Check Deadline', desc: 'Verify online.', date: '20241010T000000Z' }
    ],
    news: [
      { source: 'Local Gov', title: 'Online voter portal sees massive surge.', time: '1 hour ago' }
    ]
  }
};

// UI Functions

/** Creates a Google Calendar Add Event link */
function generateGoogleCalendarLink(eventTitle, eventDesc, eventDate) {
  const title = encodeURIComponent(eventTitle);
  const details = encodeURIComponent(eventDesc);
  // Defaulting to 1 hour event duration for simplicity
  const dateEnd = eventDate.replace('T000000Z', 'T010000Z').replace('T120000Z', 'T130000Z'); 
  return \`https://calendar.google.com/calendar/render?action=TEMPLATE&text=\${title}&dates=\${eventDate}/\${dateEnd}&details=\${details}\`;
}

function updateWidgets(phaseKey) {
  if (state.currentPhase === phaseKey) return; // Prevent unnecessary DOM re-renders
  state.currentPhase = phaseKey;

  const data = phaseData[phaseKey] || phaseData.default;
  
  calendarDiv.innerHTML = data.events.map(ev => {
    const calendarLink = generateGoogleCalendarLink(ev.title, ev.desc, ev.date);
    return \`
      <div class="event-item" role="article" aria-labelledby="ev-\${ev.day}">
        <div class="event-date">
          <span class="event-month">\${ev.month}</span>
          <span class="event-day" id="ev-\${ev.day}">\${ev.day}</span>
        </div>
        <div class="event-details">
          <h4>\${ev.title}</h4>
          <p>\${ev.desc}</p>
          <a href="\${calendarLink}" target="_blank" rel="noopener noreferrer" class="calendar-add-link" aria-label="Add \${ev.title} to Google Calendar">
             📅 Add to Calendar
          </a>
        </div>
      </div>
    \`;
  }).join('');

  newsDiv.innerHTML = data.news.map(n => \`
    <div class="news-item" role="article">
      <div class="news-source">⚡ \${n.source}</div>
      <div class="news-title" tabindex="0">\${n.title}</div>
      <span class="news-time">\${n.time}</span>
    </div>
  \`).join('');
}

/** Parses basic markdown to HTML securely */
function parseMarkdown(text) {
  let html = text
    // Fix bold parsing properly
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Parse list items
    .replace(/^\\s*[-*]\\s+(.+)$/gm, '<li>$1</li>')
    // Convert newlines to breaks
    .replace(/\\n\\n/g, '<br><br>')
    .replace(/\\n(?!\\<li\\>)/g, '<br>');
    
  // Wrap lists
  if (html.includes('<li>')) {
    html = html.replace(/(<li>.*<\\/li>)/s, '<ul>$1</ul>');
  }
  return html;
}

function addMessage(role, text, isError = false) {
  const div = document.createElement('div');
  div.className = 'msg ' + (role === 'user' ? 'user' : 'bot');
  div.setAttribute('role', 'listitem');
  
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? 'U' : '🗳️';
  avatar.setAttribute('aria-hidden', 'true');
  
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  
  if (isError) {
    bubble.textContent = text; // Safe assignment for errors
    bubble.style.color = 'var(--accent-red)';
  } else if (role === 'user') {
    bubble.textContent = text; // User input should always be textContent to prevent XSS natively
  } else {
    // Parse AI markdown and sanitize with DOMPurify
    const rawHtml = parseMarkdown(text);
    bubble.innerHTML = window.DOMPurify.sanitize(rawHtml, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'] });
  }
  
  div.appendChild(avatar);
  div.appendChild(bubble);
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = 'typing-indicator';
  div.setAttribute('aria-hidden', 'true'); // Hide from screen readers to prevent noise, relies on aria-live polite elsewhere
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
  
  showTyping();
  state.isLoading = true;
  sendBtn.disabled = true;

  try {
    const reply = await callGeminiAPI(apiKey, text);
    hideTyping();
    addMessage('bot', reply);
  } catch (e) {
    hideTyping();
    state.chatHistory.pop(); // Revert user message from history
    addMessage('bot', 'Error: ' + e.message, true);
  } finally {
    state.isLoading = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

// Debounce state
let debounceTimer;

export function sendMessage() {
  const text = input.value.trim();
  if (!text || state.isLoading) return;
  
  // Debounce logic
  if (debounceTimer) return;
  debounceTimer = setTimeout(() => { debounceTimer = null; }, 1000);

  addMessage('user', text);
  input.value = '';
  handleAPICall(text);
}

export function askPhase(phase, btnElem) {
  if (state.isLoading) return;
  
  // Accessibility: aria-pressed updates
  document.querySelectorAll('.phase-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  btnElem.classList.add('active');
  btnElem.setAttribute('aria-pressed', 'true');
  
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

export function searchPollingPlace() {
  const zipInput = document.getElementById('zip-input');
  const iframeContainer = document.getElementById('map-iframe-container');
  if(!zipInput || !iframeContainer) return;

  const zip = zipInput.value.trim();
  if(!zip) return;

  const query = encodeURIComponent(\`polling places near \${zip}\`);
  // Meaningful Google Maps integration via iframe embed API (assuming general search, though Civic Info API is better, Maps iframe works for a visual)
  iframeContainer.innerHTML = \`<iframe width="100%" height="200" style="border:0; border-radius:10px; margin-top:10px;" loading="lazy" allowfullscreen src="https://www.google.com/maps/embed/v1/search?q=\${query}&key=\${apiKeyInput.value.trim()}"></iframe>\`;
}


// Event Listeners (Removed inline onclicks from HTML requires us to bind them, but since index.html has inline onclick="sendMessage()" etc, 
// we must attach them to the window. However, the audit specifically requested removing inline onclicks! 
// We will update index.html to have IDs and classes and bind them here.)

window.addEventListener('DOMContentLoaded', () => {
  // Bind Timeline buttons
  document.querySelectorAll('.phase-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      askPhase(e.currentTarget.dataset.phase, e.currentTarget);
    });
  });

  // Bind Quick Chips
  document.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      sendChip(e.currentTarget.dataset.query);
    });
  });

  // Bind Input Actions
  if(sendBtn) sendBtn.addEventListener('click', sendMessage);
  if(input) input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

  if(micBtn) {
    micBtn.addEventListener('click', () => {
      if (recognition) {
        recognition.lang = state.language === 'en' ? 'en-US' : 'es-ES';
        recognition.start();
      }
    });
  }

  // Voter Plan logic
  if(planGeneratorBtn) {
    planGeneratorBtn.addEventListener('click', async () => {
      const apiKey = apiKeyInput.value.trim();
      
      planGeneratorBtn.innerHTML = '⏳ Generating...';
      planGeneratorBtn.disabled = true;
      
      try {
        const plan = await generateVoterPlan(apiKey);
        const rawHtml = parseMarkdown(plan);
        modalBody.innerHTML = window.DOMPurify.sanitize(rawHtml, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'] });
        modalOverlay.classList.add('active');
        closeBtn.focus(); // A11y: focus modal close
      } catch(e) {
        modalBody.textContent = 'Error: ' + e.message;
        modalOverlay.classList.add('active');
      } finally {
        planGeneratorBtn.innerHTML = '📋 Generate Custom Voter Plan';
        planGeneratorBtn.disabled = false;
      }
    });
  }

  if(closeBtn) {
    closeBtn.addEventListener('click', () => {
      modalOverlay.classList.remove('active');
      planGeneratorBtn.focus(); // A11y: restore focus
    });
  }

  // Language Toggles
  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      langBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.language = btn.dataset.lang;
      addMessage('bot', state.language === 'en' ? "Language set to English." : "Idioma establecido a Español.");
    });
  });

  // Bind Map Search
  const mapSearchBtn = document.getElementById('map-search-btn');
  if(mapSearchBtn) {
    mapSearchBtn.addEventListener('click', searchPollingPlace);
  }

  // Init
  updateWidgets('default');
});
