import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConversationHistory } from './conversationContext';

test('keeps the newest messages in chronological order', () => {
  const history = buildConversationHistory([
    { role: 'user', text: 'primeira pergunta' },
    { role: 'assistant', text: 'primeira resposta' },
    { role: 'user', text: 'pergunta recente' },
    { role: 'assistant', text: 'resposta recente' },
  ], { maxMessages: 3, maxChars: 1000, maxMessageChars: 1000 });

  assert.ok(history.indexOf('primeira resposta') < history.indexOf('pergunta recente'));
  assert.ok(history.indexOf('pergunta recente') < history.indexOf('resposta recente'));
  assert.ok(!history.includes('primeira pergunta'));
});

test('prioritizes recent messages when the character budget is exhausted', () => {
  const history = buildConversationHistory([
    { role: 'user', text: 'old '.repeat(100) },
    { role: 'assistant', text: 'recent context' },
    { role: 'user', text: 'latest request' },
  ], { maxMessages: 3, maxChars: 40, maxMessageChars: 500 });

  assert.ok(history.includes('latest request'));
  assert.ok(history.length <= 40);
});

test('limits individual messages and total history size', () => {
  const history = buildConversationHistory([
    { role: 'user', text: 'x'.repeat(1000) },
  ], { maxMessages: 10, maxChars: 120, maxMessageChars: 50 });

  assert.ok(history.length <= 120);
  assert.ok(history.length <= 57);
});
