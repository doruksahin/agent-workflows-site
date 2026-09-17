import { readFileSync } from 'node:fs';

export function GET() {
  return new Response(readFileSync('public/maps/agent-workflows.html', 'utf8'), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="agent-workflows.html"',
    },
  });
}
