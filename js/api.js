"use strict";

export const state = {
  chatHistory: [],
  isLoading: false,
  language: 'en', // 'en' or 'es'
  currentPhase: 'default',
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

/**
 * Validates the Gemini API key format (starts with AIza)
 */
export function validateApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return false;
  return apiKey.trim().startsWith('AIza');
}

/**
 * Executes a fetch call with exponential backoff retry logic.
 */
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
      // Exponential backoff: wait 1s, then 2s
      await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt - 1)));
    }
  }
}

export async function callGeminiAPI(apiKey, userMsg) {
  if (!validateApiKey(apiKey)) {
    throw new Error('Invalid API Key format. Gemini API keys must start with "AIza".');
  }

  state.chatHistory.push({ role: 'user', content: userMsg });
  state.voterPlanData.push(userMsg); // Track for plan generation

  // Bound chat history to the last 10 messages (efficiency/token limits)
  if (state.chatHistory.length > 10) {
    state.chatHistory = state.chatHistory.slice(-10);
  }

  const geminiHistory = state.chatHistory.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));
  
  const systemText = SYSTEM_PROMPTS[state.language];
  const url = \`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${apiKey}\`;

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

  // Bound voter plan context to 20 messages to ensure we don't exceed context window
  if (state.voterPlanData.length > 20) {
    state.voterPlanData = state.voterPlanData.slice(-20);
  }

  return reply;
}

export async function generateVoterPlan(apiKey) {
  if (!validateApiKey(apiKey)) {
    throw new Error('Invalid API Key format. Gemini API keys must start with "AIza".');
  }

  const context = state.voterPlanData.join('\\n');
  const prompt = state.language === 'en' 
    ? \`Based on this conversation history, generate a personalized, actionable 5-step checklist for the user to participate in the election. Make it clear and structured using Markdown bullet points. Context: \${context}\`
    : \`Basado en el historial de conversación, genera una lista de verificación personalizada y procesable de 5 pasos para que el usuario participe en la elección. Usa viñetas Markdown. Contexto: \${context}\`;

  const url = \`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${apiKey}\`;
  
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
