import { execFile } from 'child_process';

export function execFileAsync(cmd: string, args: string[], opts: { timeout: number }): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, opts, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

export function parseJson<T>(raw: string): T {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf('{');
    if (start === -1) throw new Error(`No JSON object found: ${raw.slice(0, 300)}`);
    let depth = 0;
    let end = -1;
    for (let i = start; i < trimmed.length; i++) {
      if (trimmed[i] === '{') depth++;
      else if (trimmed[i] === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end === -1) throw new Error(`Unclosed JSON object: ${raw.slice(0, 300)}`);
    return JSON.parse(trimmed.slice(start, end + 1)) as T;
  }
}
