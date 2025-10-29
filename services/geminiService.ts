import { GoogleGenAI, GenerateContentResponse, Part, Type } from "@google/genai";
import { GeminiResponse, Message, Role, VisualGuide } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        response_text: {
            type: Type.STRING,
            description: "The textual answer to the user's question."
        },
        highlights: {
            type: Type.ARRAY,
            description: "An optional list of areas to highlight on the screen.",
            items: {
                type: Type.OBJECT,
                properties: {
                    x: { type: Type.NUMBER, description: "The normalized x-coordinate (from 0.0 to 1.0) of the top-left corner of the highlight box." },
                    y: { type: Type.NUMBER, description: "The normalized y-coordinate (from 0.0 to 1.0) of the top-left corner of the highlight box." },
                    width: { type: Type.NUMBER, description: "The normalized width (from 0.0 to 1.0) of the highlight box." },
                    height: { type: Type.NUMBER, description: "The normalized height (from 0.0 to 1.0) of the highlight box." },
                },
                required: ["x", "y", "width", "height"],
            }
        },
        visual_guides: {
            type: Type.ARRAY,
            description: "An optional list of visual guides to draw on the screen to help the user, such as arrows, text labels, or numbered steps.",
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, description: "The type of guide ('arrow', 'text', 'number_badge')." },
                    // Arrow properties
                    startX: { type: Type.NUMBER, description: "For 'arrow' type: The normalized starting x-coordinate." },
                    startY: { type: Type.NUMBER, description: "For 'arrow' type: The normalized starting y-coordinate." },
                    endX: { type: Type.NUMBER, description: "For 'arrow' type: The normalized ending x-coordinate." },
                    endY: { type: Type.NUMBER, description: "For 'arrow' type: The normalized ending y-coordinate." },
                    label: { type: Type.STRING, description: "For 'arrow' type: An optional text label for the arrow." },
                    // Text/Number Badge properties
                    x: { type: Type.NUMBER, description: "For 'text' or 'number_badge' types: The normalized x-coordinate of the guide." },
                    y: { type: Type.NUMBER, description: "For 'text' or 'number_badge' types: The normalized y-coordinate of the guide." },
                    text: { type: Type.STRING, description: "For 'text' type: The text content of the label." },
                    number: { type: Type.INTEGER, description: "For 'number_badge' type: The number for the badge." },
                },
                 required: ["type"],
            }
        }
    },
    required: ["response_text"],
};

export async function askAboutScreen(messages: Message[], imageBase64: string | null, systemInstruction: string): Promise<GeminiResponse> {
  // Construct a single prompt with conversation history for context
  const conversationHistory = messages
    .slice(1, -1) // Exclude initial greeting and the current prompt
    .map(m => `${m.role === Role.USER ? 'User' : 'Assistant'}: ${m.text}`)
    .join('\n\n');
  
  const currentPrompt = messages[messages.length - 1].text;
  const fullPrompt = `This is the conversation history so far:\n${conversationHistory}\n\nHere is the current user request: "${currentPrompt}"`;

  const parts: Part[] = [{ text: fullPrompt }];

  if (imageBase64) {
    parts.unshift({
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64,
      },
    });
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: parts },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });
    
    try {
        const parsed = JSON.parse(response.text);
        return {
            text: parsed.response_text || "I'm sorry, I couldn't formulate a proper response.",
            annotations: parsed.highlights || [],
            visualGuides: (parsed.visual_guides || []) as VisualGuide[],
        };
    } catch (e) {
        console.error("Failed to parse JSON response:", response.text, e);
        // Fallback if JSON is malformed, just return the raw text.
        return { text: response.text, annotations: [], visualGuides: [] };
    }

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    return {
        text: `Error: ${message}`,
        annotations: [],
        visualGuides: [],
    };
  }
}


export async function generateSummary(messages: Message[], imageBase64: string | null): Promise<string> {
    // Filter out the initial assistant message to avoid including it in the summary
    const conversationHistory = messages.slice(1).map(m => `${m.role === Role.USER ? 'User' : 'Assistant'}: ${m.text}`).join('\n');
    const prompt = `Based on the following conversation history, which may involve multiple speakers, and the final screenshot of the shared screen (if provided), generate a concise summary structured as meeting minutes. Your primary task is to identify and differentiate between speakers (e.g., "Speaker 1:", "Speaker 2:"). Use conversational cues from the text to attribute statements. The summary should include key decisions, action items, and main topics. Where relevant, refer to visual elements from the screenshot to provide context. Format the output in Markdown.\n\nConversation:\n${conversationHistory}`;

    const parts: Part[] = [{ text: prompt }];

    if (imageBase64) {
        parts.unshift({
            inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64,
            },
        });
    }

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: {
                systemInstruction: "You are an expert at summarizing conversations that may involve visual context. Your task is to convert a transcript and a final screenshot into a well-structured and professional summary, formatted in Markdown. Identify key points, decisions, and action items, incorporating visual references where applicable.",
            }
        });
        return response.text;
    } catch (error) {
        console.error("Error generating summary:", error);
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        throw new Error(`Failed to generate summary: ${message}`);
    }
}