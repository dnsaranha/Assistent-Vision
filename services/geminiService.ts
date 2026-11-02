import { GeminiResponse, Message, VisualGuide } from "../types";
import { auth } from "../firebase";

// The API is deployed in the same Vercel project and uses the same origin.
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
      messages,
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
      messages,
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
