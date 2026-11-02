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
    const separatorLength = selected.length > 0 ? 2 : 0;
    const available = remaining - separatorLength;
    if (available <= 0) break;
    if (line.length > available) {
      selected.push(line.slice(-available));
      remaining = 0;
      break;
    }
    selected.push(line);
    remaining = available - line.length;
  }

  return selected.reverse().join('\n\n');
}
