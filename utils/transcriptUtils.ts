/**
 * Utilities for merging and deduplicating real-time streaming transcripts
 * from speech recognition and Gemini Live API.
 */

/**
 * Removes consecutive duplicate words or identical duplicate phrases
 * (e.g., "Quando Quando eu eu" -> "Quando eu",
 *        "vezes a mesma coisa. vezes a mesma coisa." -> "vezes a mesma coisa.")
 */
export function removeStuttersAndDuplicates(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // Add space between lowercase letter followed immediately by capitalized word (e.g. "IssoEntendi" -> "Isso Entendi")
  cleaned = cleaned.replace(/([\p{Ll}])([\p{Lu}])/gu, '$1. $2');

  // Clean up weird double punctuation like ",," or ".."
  cleaned = cleaned.replace(/([.,!?;:]){2,}/g, '$1');

  // Loop until no more duplicates are found
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 5) {
    changed = false;
    iterations++;

    // 1. Remove duplicate adjacent phrases of 2 to 10 words
    // E.g., "vezes a mesma coisa. vezes a mesma coisa."
    const words = cleaned.split(/\s+/);
    for (let phraseLen = Math.min(10, Math.floor(words.length / 2)); phraseLen >= 2; phraseLen--) {
      let i = 0;
      const newWords: string[] = [];
      let foundDuplicate = false;
      while (i < words.length) {
        if (i + phraseLen * 2 <= words.length) {
          const phrase1 = words.slice(i, i + phraseLen).join(' ').toLowerCase().replace(/[.,!?;:]/g, '');
          const phrase2 = words.slice(i + phraseLen, i + phraseLen * 2).join(' ').toLowerCase().replace(/[.,!?;:]/g, '');
          if (phrase1 === phrase2 && phrase1.length > 3) {
            // Keep the first phrase, skip the second
            for (let j = 0; j < phraseLen; j++) {
              newWords.push(words[i + j]);
            }
            i += phraseLen * 2;
            foundDuplicate = true;
            changed = true;
            continue;
          }
        }
        newWords.push(words[i]);
        i++;
      }
      if (foundDuplicate) {
        cleaned = newWords.join(' ');
        break; // Re-evaluate with updated cleaned string
      }
    }

    // 2. Remove immediate duplicate adjacent single words (e.g. "Quando Quando", "eu eu", "sai sai")
    const prevText = cleaned;
    cleaned = cleaned.replace(/\b(\p{L}+)(?:[,\s]+)\1\b/gui, '$1');
    if (cleaned !== prevText) {
      changed = true;
    }
  }

  return cleaned.trim();
}

/**
 * Merges an incoming transcript update with the accumulated transcript for a turn.
 * Handles cumulative updates, delta streaming, and overlapping sliding windows.
 */
export function mergeTranscript(existing: string, incoming: string): string {
  if (!incoming) return existing;
  if (!existing) return removeStuttersAndDuplicates(incoming);

  const ex = existing.trim();
  const inc = incoming.trim();

  // If incoming already starts with existing (full cumulative update)
  if (inc.startsWith(ex)) {
    return removeStuttersAndDuplicates(inc);
  }

  // If existing already starts with incoming (out of order or shorter interim)
  if (ex.startsWith(inc) || ex.endsWith(inc)) {
    return removeStuttersAndDuplicates(ex);
  }

  // Check word-level overlap at the boundary
  const exWords = ex.split(/\s+/);
  const incWords = inc.split(/\s+/);

  const maxWordOverlap = Math.min(exWords.length, incWords.length);
  for (let len = maxWordOverlap; len > 0; len--) {
    const exSlice = exWords.slice(exWords.length - len).join(' ').toLowerCase().replace(/[.,!?;:]/g, '');
    const incSlice = incWords.slice(0, len).join(' ').toLowerCase().replace(/[.,!?;:]/g, '');
    if (exSlice === incSlice) {
      const remainingInc = incWords.slice(len).join(' ');
      const result = remainingInc ? `${ex} ${remainingInc}` : ex;
      return removeStuttersAndDuplicates(result);
    }
  }

  // Check character-level boundary overlap
  const maxCharOverlap = Math.min(ex.length, inc.length, 60);
  for (let len = maxCharOverlap; len >= 3; len--) {
    const exSuffix = ex.slice(-len).toLowerCase();
    const incPrefix = inc.slice(0, len).toLowerCase();
    if (exSuffix === incPrefix) {
      const result = ex + inc.slice(len);
      return removeStuttersAndDuplicates(result);
    }
  }

  // Default delta append
  const spacer = /[.,!?;:]$/.test(ex) || ex.endsWith(' ') || inc.startsWith(' ') ? ' ' : ' ';
  return removeStuttersAndDuplicates(`${ex}${spacer}${inc}`);
}
