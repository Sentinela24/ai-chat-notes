import { useEffect, useState } from 'react';

/** Replays `text` word by word, like a model streaming tokens. Restarts when `runId` changes. */
export function useFakeStream(text: string, { intervalMs = 40, runId = 0 } = {}) {
  const [length, setLength] = useState(0);
  const tokens = text.match(/\s*\S+\s*/g) ?? [];

  useEffect(() => {
    setLength(0);
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setLength(i);
      if (i >= tokens.length) clearInterval(timer);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [text, intervalMs, runId, tokens.length]);

  return { text: tokens.slice(0, length).join(''), done: length >= tokens.length };
}

export const SAMPLE_REPLY = `Server-Sent Events (SSE) are a simple way to **stream data from server to browser** over plain HTTP.

### Why use SSE for LLM output?
- One-way: the server pushes, the client only listens
- Works through proxies and with HTTP/2
- Text-based, so it's easy to debug with \`curl -N\`

\`\`\`ts
for await (const event of streamEvents('/api/chat', body, signal)) {
  if (event.type === 'delta') append(event.text);
}
\`\`\`

| Transport | Direction | Reconnect |
| --------- | --------- | --------- |
| SSE       | server → client | built in |
| WebSocket | both ways | manual |`;
