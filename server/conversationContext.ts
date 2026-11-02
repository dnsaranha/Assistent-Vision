export interface ConversationMessage {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * Keep the newest useful context within explicit message and character budgets.
 * Newest turns are prioritized; output order remains chronological.
 */
export function buildConversationHistory(
  messages: ConversationMessage[],
  options: { maxMessages: number; maxChars: number; maxMessageChars: number }
): string {
  const selected: string[] = [];
  let remaining = options.maxChars;

  for (const message of [...messages].slice(-options.maxMessages).reverse()) {
    const text = message.text.trim().slice(-options.maxMessageChars);
    if (!text || remaining <= 0) continue;
    const line = `${message.role === 'user' ? 'User' : 'Assistant'}: ${text}`;
    if (line.length > remaining) {
      const clipped = line.slice(-remaining);
      selected.push(clipped);
      remaining = 0;
      break;
    }
    selected.push(line);
    remaining -= line.length;
  }

  return selected.reverse().join('\n\n');
}
