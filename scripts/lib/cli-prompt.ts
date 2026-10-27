import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as defaultInput, stdout as defaultOutput } from 'node:process';

export type AskFn = (query: string) => Promise<string>;

export interface PromptSessionOptions {
  ask?: AskFn;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

export interface PromptSession {
  ask: AskFn;
  close: () => void;
}

export function createPromptSession(options: PromptSessionOptions = {}): PromptSession {
  if (options.ask) {
    return {
      ask: options.ask,
      close: () => {},
    };
  }

  const inStream = options.input ?? defaultInput;
  const outStream = options.output ?? defaultOutput;
  const isTty = Boolean((inStream as NodeJS.ReadStream).isTTY);

  if (isTty) {
    const rl = createInterface({ input: inStream, output: outStream });
    return {
      ask: (query: string) => rl.question(query),
      close: () => rl.close(),
    };
  }

  let allLines: string[] | null = null;
  let cursor = 0;

  return {
    ask: async (query: string) => {
      if (allLines === null) {
        try {
          allLines = readFileSync(0, 'utf-8').split(/\r?\n/);
        } catch {
          allLines = [];
        }
      }
      outStream.write(query);
      if (cursor >= allLines.length) {
        return '0';
      }
      const line = allLines[cursor] ?? '';
      cursor += 1;
      outStream.write(`${line}\n`);
      return line;
    },
    close: () => {},
  };
}
