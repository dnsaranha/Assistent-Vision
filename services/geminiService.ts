import { GeminiResponse, Message, VisualGuide } from "../types";
import { auth } from "../firebase";

// The API is deployed in the same Vercel project and uses the same origin.
// Keep requests compact before they cross the network boundary.
function compactMessages(messages: Message[], maxMessages = 24, maxChars = 32000): Message[] {
  const selected: Message[] = [];
  let remaining = maxChars;
  for (const message of messages.slice(-maxMessages).reverse()) {
    if (remaining <= 0) break;
    const text = message.text.trim().slice(-Math.min(4000, remaining));
    if (!text) continue;
    selected.push({ role: message.role, text });
    remaining -= text.length;
  }
  return selected.reverse();
}


function apiUrl(path: string): string {
  return path;
}

async function authenticatedHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) throw new Error('Entre na sua conta para usar este recurso.');
  const token = await user.getIdToken();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function askAboutScreen(
  messages: Message[],
  imageBase64: string | null,
  systemInstruction: string
): Promise<GeminiResponse> {
  const response = await fetch(apiUrl('/api/screen/ask'), {
    method: 'POST',
    headers: await authenticatedHeaders(),
    body: JSON.stringify({
      messages: compactMessages(messages, 20, 26000),
      imageBase64,
      systemInstruction,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro do servidor (${response.status}) ao processar tela.`);
  }

  const data = await response.json();
  return {
    text: data.text || "Desculpe, não consegui obter uma resposta para a tela.",
    annotations: data.annotations || [],
    visualGuides: (data.visualGuides || []) as VisualGuide[],
  };
}

export async function generateSummary(
  messages: Message[],
  imageBase64: string | null
): Promise<string> {
  const response = await fetch(apiUrl('/api/screen/summary'), {
    method: 'POST',
    headers: await authenticatedHeaders(),
    body: JSON.stringify({
      messages: compactMessages(messages, 28, 32000),
      imageBase64,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro do servidor (${response.status}) ao gerar resumo.`);
  }

  const data = await response.json();
  return data.summary || "";
}
