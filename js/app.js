"use strict";

// --- API & State Logic ---

const state = {
  chatHistory: [],
  isLoading: false,
  language: 'en', // 'en' or 'es'
  currentPhase: null,
  voterPlanData: []
};

const SYSTEM_PROMPTS = {
  en: `You are a helpful, neutral, and educational assistant focused on explaining election processes. You cover:
- Voter registration requirements and deadlines
- Primary elections and how candidates are chosen
- Campaign finance, rallies, and debates
- Early voting and absentee/mail-in voting
- Election day procedures and polling
- How votes are counted and post-election audits
- The Electoral College (for US elections)
- Inauguration and transition of power

Keep answers clear, factual, and non-partisan. Structure longer answers with bullet points. Keep responses concise (3–5 sentences).`,
  es: `Eres un asistente educativo neutral y útil enfocado en explicar los procesos electorales. Cubres:
- Requisitos de registro de votantes
- Elecciones primarias
- Financiación de campañas y debates
- Voto anticipado y por correo
- Día de las elecciones y votación
- Conteo de votos y auditorías
- El Colegio Electoral
- Inauguración

Mantén las respuestas claras, fácticas y no partidistas. Usa viñetas. Mantén las respuestas concisas (3-5 oraciones).`
};

function validateApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return false;
  return apiKey.trim().startsWith('AIza');
}

async function fetchWithRetry(url, options, maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message || 'API Error');
      }
      return data;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      attempt++;
      await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt - 1)));
    }
  }
}

async function callGeminiAPI(apiKey, userMsg) {
  if (!validateApiKey(apiKey)) {
    throw new Error('Invalid API Key format. Gemini API keys must start with "AIza".');
  }

  state.chatHistory.push({ role: 'user', content: userMsg });
  state.voterPlanData.push(userMsg);

  if (state.chatHistory.length > 10) {
    state.chatHistory = state.chatHistory.slice(-10);
  }

  const geminiHistory = state.chatHistory.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));
  
  const systemText = SYSTEM_PROMPTS[state.language];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const data = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: geminiHistory,
      generationConfig: { maxOutputTokens: 1000 }
    })
  });
  
  const reply = data.candidates[0].content.parts[0].text;
  state.chatHistory.push({ role: 'assistant', content: reply });
  state.voterPlanData.push(reply);

  if (state.voterPlanData.length > 20) {
    state.voterPlanData = state.voterPlanData.slice(-20);
  }

  return reply;
}

async function generateVoterPlan(apiKey) {
  if (!validateApiKey(apiKey)) {
    throw new Error('Invalid API Key format. Gemini API keys must start with "AIza".');
  }

  const context = state.voterPlanData.join('\\n');
  const prompt = state.language === 'en' 
    ? `Based on this conversation history, generate a personalized, actionable 5-step checklist for the user to participate in the election. Make it clear and structured using Markdown bullet points. Context: ${context}`
    : `Basado en el historial de conversación, genera una lista de verificación personalizada y procesable de 5 pasos para que el usuario participe en la elección. Usa viñetas Markdown. Contexto: ${context}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const data = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 800, temperature: 0.2 }
    })
  });
  
  return data.candidates[0].content.parts[0].text;
}


// --- UI Logic ---

document.addEventListener('DOMContentLoaded', () => {

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
  const pollingPlaceDiv = document.getElementById('polling-place-widget');

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
    if(micBtn) micBtn.style.display = 'none';
  }

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

  function generateGoogleCalendarLink(eventTitle, eventDesc, eventDate) {
    const title = encodeURIComponent(eventTitle);
    const details = encodeURIComponent(eventDesc);
    const dateEnd = eventDate.replace('T000000Z', 'T010000Z').replace('T120000Z', 'T130000Z'); 
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${eventDate}/${dateEnd}&details=${details}`;
  }

  function updateWidgets(phaseKey) {
    if (state.currentPhase === phaseKey) return;
    state.currentPhase = phaseKey;

    const data = phaseData[phaseKey] || phaseData.default;
    
    if (calendarDiv) {
      calendarDiv.innerHTML = data.events.map(ev => {
        const calendarLink = generateGoogleCalendarLink(ev.title, ev.desc, ev.date);
        return `
          <div class="event-item" role="article" aria-labelledby="ev-${ev.day}">
            <div class="event-date">
              <span class="event-month">${ev.month}</span>
              <span class="event-day" id="ev-${ev.day}">${ev.day}</span>
            </div>
            <div class="event-details">
              <h4>${ev.title}</h4>
              <p>${ev.desc}</p>
              <a href="${calendarLink}" target="_blank" rel="noopener noreferrer" class="calendar-add-link" aria-label="Add ${ev.title} to Google Calendar">
                 📅 Add to Calendar
              </a>
            </div>
          </div>
        `;
      }).join('');
    }

    if (newsDiv) {
      newsDiv.innerHTML = data.news.map(n => `
        <div class="news-item" role="article">
          <div class="news-source">⚡ ${n.source}</div>
          <div class="news-title" tabindex="0">${n.title}</div>
          <span class="news-time">${n.time}</span>
        </div>
      `).join('');
    }
  }

  function parseMarkdown(text) {
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n(?!<li>)/g, '<br>');
      
    if (html.includes('<li>')) {
      html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
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
      bubble.textContent = text;
      bubble.style.color = 'var(--accent-red)';
    } else if (role === 'user') {
      bubble.textContent = text;
    } else {
      const rawHtml = parseMarkdown(text);
      if (window.DOMPurify) {
        bubble.innerHTML = window.DOMPurify.sanitize(rawHtml, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'] });
      } else {
        bubble.textContent = text; // Fallback if DOMPurify fails to load
      }
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
    div.setAttribute('aria-hidden', 'true');
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
      state.chatHistory.pop();
      addMessage('bot', 'Error: ' + e.message, true);
    } finally {
      state.isLoading = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  let debounceTimer;

  function sendMessage() {
    const text = input.value.trim();
    if (!text || state.isLoading) return;
    
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => { debounceTimer = null; }, 1000);

    addMessage('user', text);
    input.value = '';
    handleAPICall(text);
  }

  function askPhase(phase, btnElem) {
    if (state.isLoading) return;
    
    document.querySelectorAll('.phase-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btnElem.classList.add('active');
    btnElem.setAttribute('aria-pressed', 'true');
    
    updateWidgets(phase);
    
    const msg = state.language === 'en' 
      ? `Explain the "${phase}" phase of the election process.`
      : `Explica la fase "${phase}" del proceso electoral.`;
      
    addMessage('user', (state.language === 'en' ? 'Tell me about: ' : 'Háblame de: ') + phase);
    handleAPICall(msg);
  }

  function sendChip(text) {
    if (state.isLoading) return;
    addMessage('user', text);
    handleAPICall(text);
  }

  function searchPollingPlace() {
    const zipInput = document.getElementById('zip-input');
    const iframeContainer = document.getElementById('map-iframe-container');
    if(!zipInput || !iframeContainer) return;

    const zip = zipInput.value.trim();
    if(!zip) return;

    const query = encodeURIComponent(`polling places near ${zip}`);
    iframeContainer.innerHTML = `<iframe width="100%" height="200" style="border:0; border-radius:10px; margin-top:10px;" loading="lazy" allowfullscreen src="https://www.google.com/maps/embed/v1/search?q=${query}&key=${apiKeyInput.value.trim()}"></iframe>`;
  }

  // --- Attach Event Listeners ---

  document.querySelectorAll('.phase-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      askPhase(e.currentTarget.dataset.phase, e.currentTarget);
    });
  });

  document.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      sendChip(e.currentTarget.dataset.query);
    });
  });

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

  if(planGeneratorBtn) {
    planGeneratorBtn.addEventListener('click', async () => {
      const apiKey = apiKeyInput.value.trim();
      
      planGeneratorBtn.innerHTML = '⏳ Generating...';
      planGeneratorBtn.disabled = true;
      
      try {
        const plan = await generateVoterPlan(apiKey);
        const rawHtml = parseMarkdown(plan);
        if (window.DOMPurify) {
          modalBody.innerHTML = window.DOMPurify.sanitize(rawHtml, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'] });
        } else {
          modalBody.textContent = plan;
        }
        modalOverlay.classList.add('active');
        if(closeBtn) closeBtn.focus();
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
      if(planGeneratorBtn) planGeneratorBtn.focus();
    });
  }

  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      langBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.language = btn.dataset.lang;
      addMessage('bot', state.language === 'en' ? "Language set to English." : "Idioma establecido a Español.");
    });
  });

  const mapSearchBtn = document.getElementById('map-search-btn');
  if(mapSearchBtn) {
    mapSearchBtn.addEventListener('click', searchPollingPlace);
  }

  // Initialize
  updateWidgets('default');

});
