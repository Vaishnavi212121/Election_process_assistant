// API & State Logic

export const state = {
  history: [],
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

export async function callGeminiAPI(apiKey, userMsg) {
  if (!apiKey) throw new Error('API Key missing');

  state.history.push({ role: 'user', content: userMsg });
  state.voterPlanData.push(userMsg); // Track for plan generation

  const geminiHistory = state.history.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));
  
  const systemText = SYSTEM_PROMPTS[state.language];

  const res = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${apiKey}\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: geminiHistory,
      generationConfig: { maxOutputTokens: 1000 }
    })
  });
  
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  
  const reply = data.candidates[0].content.parts[0].text;
  state.history.push({ role: 'assistant', content: reply });
  state.voterPlanData.push(reply);

  return reply;
}

export async function generateVoterPlan(apiKey) {
  if (!apiKey) throw new Error('API Key missing for plan generation');

  const context = state.voterPlanData.join('\\n');
  const prompt = state.language === 'en' 
    ? \`Based on this conversation history, generate a personalized, actionable 5-step checklist for the user to participate in the election. Make it clear and structured using Markdown bullet points. Context: \${context}\`
    : \`Basado en el historial de conversación, genera una lista de verificación personalizada y procesable de 5 pasos para que el usuario participe en la elección. Usa viñetas Markdown. Contexto: \${context}\`;

  const res = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${apiKey}\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 800, temperature: 0.2 }
    })
  });
  
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates[0].content.parts[0].text;
}
