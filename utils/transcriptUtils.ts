/**
 * Utilities for merging, deduplicating, and cleaning real-time streaming transcripts
 * from speech recognition and Gemini Live API.
 */

function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Removes immediate consecutive duplicate words, stuttered syllables,
 * and duplicate repeated phrases caused by speech recognition interims.
 * Examples:
 * - "Quando Quando eu eu" -> "Quando eu"
 * - "sai sai duas duas vezes a mesma coisa. vezes a mesma coisa." -> "sai duas vezes a mesma coisa."
 * - "Que bom!Ótimo! Fico feliz em saber. Como posso Fico te ajudar? feliz." -> "Que bom! Ótimo! Fico feliz em saber. Como posso te ajudar?"
 */
export function removeStuttersAndDuplicates(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // Insert space between lowercase letter followed immediately by uppercase letter (e.g. "IssoEntendi" -> "Isso Entendi")
  cleaned = cleaned.replace(/([\p{Ll}])([\p{Lu}])/gu, '$1. $2');

  // Clean repeated punctuation like ",," or ".." or "!?"
  cleaned = cleaned.replace(/([.,!?;:]){2,}/g, '$1');

  // Fix glued punctuation without space (e.g. "bom!Ótimo!" -> "bom! Ótimo!")
  cleaned = cleaned.replace(/([.!?])([A-Za-zÀ-ÿ])/g, '$1 $2');

  // Fix common speech repetition artifacts like "falolo" -> "falo"
  cleaned = cleaned.replace(/\b(\w{3,})lo\1?\b/gi, '$1');

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 6) {
    changed = false;
    iterations++;

    // 1. Remove duplicate adjacent phrases of 2 to 12 words
    // E.g. "vezes a mesma coisa. vezes a mesma coisa." -> "vezes a mesma coisa."
    const words = cleaned.split(/\s+/).filter(Boolean);
    const maxPhraseLen = Math.min(12, Math.floor(words.length / 2));

    for (let phraseLen = maxPhraseLen; phraseLen >= 2; phraseLen--) {
      let i = 0;
      const newWords: string[] = [];
      let foundDuplicate = false;

      while (i < words.length) {
        if (i + phraseLen * 2 <= words.length) {
          const phrase1 = normalizeForComparison(words.slice(i, i + phraseLen).join(' '));
          const phrase2 = normalizeForComparison(words.slice(i + phraseLen, i + phraseLen * 2).join(' '));

          if (phrase1.length > 3 && phrase1 === phrase2) {
            // Found duplicate adjacent phrase, keep first, skip second
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
        break;
      }
    }

    // 2. Remove duplicate adjacent single words (e.g. "Quando Quando", "eu eu", "sai sai", "duas duas")
    const prevText = cleaned;
    cleaned = cleaned.replace(/\b([\p{L}\d]+)(?:[,\s]+)\1\b/gui, '$1');
    if (cleaned !== prevText) {
      changed = true;
    }
  }

  // Final trim and whitespace normalization
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Merges an incoming transcript update with the accumulated transcript for a turn.
 * Robustly handles cumulative updates, interim STT hypotheses, and streaming deltas.
 */
export function mergeTranscript(existing: string, incoming: string): string {
  if (!incoming || !incoming.trim()) return existing;
  if (!existing || !existing.trim()) return removeStuttersAndDuplicates(incoming);

  const ex = existing.trim();
  const inc = incoming.trim();

  const normEx = normalizeForComparison(ex);
  const normInc = normalizeForComparison(inc);

  // If incoming contains the existing text as a prefix (cumulative update from STT)
  if (normInc.startsWith(normEx)) {
    return removeStuttersAndDuplicates(inc);
  }

  // If existing already ends with or completely covers incoming
  if (normEx.endsWith(normInc) || normEx === normInc) {
    return removeStuttersAndDuplicates(ex);
  }

  // Check word-level overlap at the boundary
  const exWords = ex.split(/\s+/).filter(Boolean);
  const incWords = inc.split(/\s+/).filter(Boolean);

  const maxOverlap = Math.min(exWords.length, incWords.length);
  for (let len = maxOverlap; len > 0; len--) {
    const exTail = normalizeForComparison(exWords.slice(exWords.length - len).join(' '));
    const incHead = normalizeForComparison(incWords.slice(0, len).join(' '));

    if (exTail.length > 2 && exTail === incHead) {
      const remainingInc = incWords.slice(len).join(' ');
      const result = remainingInc ? `${ex} ${remainingInc}` : ex;
      return removeStuttersAndDuplicates(result);
    }
  }

  // Check character-level boundary overlap
  const maxCharOverlap = Math.min(ex.length, inc.length, 50);
  for (let len = maxCharOverlap; len >= 3; len--) {
    const exSuffix = normalizeForComparison(ex.slice(-len));
    const incPrefix = normalizeForComparison(inc.slice(0, len));
    if (exSuffix.length > 2 && exSuffix === incPrefix) {
      const result = ex + inc.slice(len);
      return removeStuttersAndDuplicates(result);
    }
  }

  // If incoming is very short (1-2 words) and appears earlier in existing, discard to avoid stutter
  if (incWords.length <= 2 && normEx.includes(normInc)) {
    return removeStuttersAndDuplicates(ex);
  }

  // Default delta append with proper spacing
  const needsSpace = !ex.endsWith(' ') && !inc.startsWith(' ');
  return removeStuttersAndDuplicates(`${ex}${needsSpace ? ' ' : ''}${inc}`);
}
