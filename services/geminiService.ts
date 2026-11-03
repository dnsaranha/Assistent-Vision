import { GeminiResponse, Message, VisualGuide } from "../types";

export async function askAboutScreen(
  messages: Message[],
  imageBase64: string | null,
  systemInstruction: string
): Promise<GeminiResponse> {
  const response = await fetch('/api/gemini/ask-screen', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      imageBase64,
      systemInstruction,
    }),
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}: Falha ao contatar o servidor.`;
    try {
      const errorJson = await response.json();
      if (errorJson.error) {
        errorMsg = errorJson.error;
      }
    } catch {}
    throw new Error(errorMsg);
  }

  const data = await response.json();
  return {
    text: data.text || "Desculpe, não consegui formular uma resposta.",
    annotations: data.annotations || [],
    visualGuides: (data.visualGuides || []) as VisualGuide[],
  };
}

export async function generateSummary(
  messages: Message[],
  imageBase64: string | null
): Promise<string> {
  const response = await fetch('/api/gemini/summary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      imageBase64,
    }),
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}: Falha ao gerar resumo.`;
    try {
      const errorJson = await response.json();
      if (errorJson.error) {
        errorMsg = errorJson.error;
      }
    } catch {}
    throw new Error(errorMsg);
  }

  const data = await response.json();
  return data.summary || '';
}
