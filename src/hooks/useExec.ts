/**
 * Command execution hook with live output streaming
 */

import type { ResultPromise } from 'execa';
import { useCallback, useRef, useState } from 'react';

import { DEFAULT_CONFIG } from '../constants.js';
import type { ExecutionResult, Result, ShellType } from '../types/index.js';
import { getShellCommand } from '../lib/platform.js';

interface UseExecState {
  isExecuting: boolean;
  liveOutput: string[];
  error: Error | null;
}

interface UseExecOptions {
  shell: ShellType;
  maxOutputLines?: number;
  onOutput?: (line: string, isError: boolean) => void;
  onComplete?: (result: ExecutionResult) => void;
}

interface UseExecReturn extends UseExecState {
  execute: (command: string) => Promise<Result<ExecutionResult>>;
  kill: () => void;
}

/**
 * Hook for executing shell commands with live output streaming
 */
export function useExec({
  shell,
  maxOutputLines = DEFAULT_CONFIG.maxOutputLines,
  onOutput,
  onComplete,
}: UseExecOptions): UseExecReturn {
  const [state, setState] = useState<UseExecState>({
    isExecuting: false,
    liveOutput: [],
    error: null,
  });

  const childRef = useRef<ResultPromise | null>(null);

  const execute = useCallback(
    async (command: string): Promise<Result<ExecutionResult>> => {
      // Reset state
      setState({
        isExecuting: true,
        liveOutput: [],
        error: null,
      });

      const { cmd, args } = getShellCommand(shell, command);

      try {
        const { execa } = await import('execa');
        const child = execa(cmd, args, {
          reject: false,
          all: true,
          buffer: true,
        });

        childRef.current = child;

        const outputLines: string[] = [];

        if (child.stdout) {
          child.stdout.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split('\n').filter(Boolean);
            for (const line of lines) {
              outputLines.push(line);
              onOutput?.(line, false);

              setState((prev) => ({
                ...prev,
                liveOutput: [...prev.liveOutput, line].slice(-maxOutputLines),
              }));
            }
          });
        }

        if (child.stderr) {
          child.stderr.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split('\n').filter(Boolean);
            for (const line of lines) {
              const errorLine = `[ERR] ${line}`;
              outputLines.push(errorLine);
              onOutput?.(line, true);

              setState((prev) => ({
                ...prev,
                liveOutput: [...prev.liveOutput, errorLine].slice(-maxOutputLines),
              }));
            }
          });
        }

        const result = await child;

        childRef.current = null;

        const executionResult: ExecutionResult = {
          command,
          stdout: result.stdout ?? '',
          stderr: result.stderr ?? '',
          exitCode: result.exitCode ?? 0,
        };

        setState((prev) => ({
          ...prev,
          isExecuting: false,
        }));

        onComplete?.(executionResult);

        return { success: true, data: executionResult };
      } catch (error) {
        childRef.current = null;

        const err = error instanceof Error ? error : new Error(String(error));

        setState((prev) => ({
          ...prev,
          isExecuting: false,
          error: err,
        }));

        const executionResult: ExecutionResult = {
          command,
          stdout: '',
          stderr: err.message,
          exitCode: 1,
        };

        onComplete?.(executionResult);

        return { success: false, error: err };
      }
    },
    [shell, maxOutputLines, onOutput, onComplete]
  );

  const kill = useCallback(() => {
    if (childRef.current) {
      childRef.current.kill('SIGINT');
      childRef.current = null;

      setState((prev) => ({
        ...prev,
        isExecuting: false,
        liveOutput: [...prev.liveOutput, '[Interrupted]'],
      }));
    }
  }, []);

  return {
    ...state,
    execute,
    kill,
  };
}
