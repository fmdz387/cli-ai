/**
 * Core type definitions for CLI AI v3
 */

/**
 * Result type for error handling - discriminated union for type-safe error handling
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Shell types supported by the application
 */
export type ShellType = 'bash' | 'zsh' | 'fish' | 'powershell' | 'pwsh' | 'cmd';

/**
 * Risk levels for commands
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * A generated command proposal from the AI
 */
export interface CommandProposal {
  command: string;
  risk: RiskLevel;
  explanation?: string;
}

/**
 * Result of executing a command
 */
export interface ExecutionResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Session states - discriminated union for state machine
 */
export type SessionState =
  | { status: 'setup' }
  | { status: 'input' }
  | { status: 'loading'; query: string }
  | { status: 'proposal'; proposal: CommandProposal }
  | { status: 'alternatives'; proposals: CommandProposal[]; originalQuery: string }
  | { status: 'executing'; command: string }
  | { status: 'output'; result: ExecutionResult };

/**
 * Session context passed to AI for command generation
 */
export interface SessionContext {
  shell: ShellType;
  cwd: string;
  platform: NodeJS.Platform;
  directoryTree: string;
  history: HistoryEntry[];
}

/**
 * A single history entry in the session
 */
export interface HistoryEntry {
  query: string;
  command: string;
  output?: string;
  exitCode?: number;
}

/**
 * User action options in proposal state
 */
export type UserAction =
  | { type: 'execute' }
  | { type: 'copy' }
  | { type: 'edit' }
  | { type: 'alternatives' }
  | { type: 'cancel' }
  | { type: 'explain' }
  | { type: 'toggle-output' };

/**
 * State machine actions
 */
export type SessionAction =
  | { type: 'SUBMIT'; query: string }
  | { type: 'AI_RESPONSE'; proposal: CommandProposal }
  | { type: 'AI_ALTERNATIVES'; proposals: CommandProposal[] }
  | { type: 'AI_ERROR'; error: Error }
  | { type: 'EXECUTE' }
  | { type: 'EXECUTE_EDITED'; command: string }
  | { type: 'EXEC_OUTPUT'; chunk: string }
  | { type: 'EXEC_DONE'; result: ExecutionResult }
  | { type: 'COPY' }
  | { type: 'EDIT'; command: string }
  | { type: 'CANCEL' }
  | { type: 'TOGGLE_OUTPUT' }
  | { type: 'SETUP_COMPLETE' };

/**
 * Application configuration
 */
export interface AppConfig {
  model: string;
  maxHistoryEntries: number;
  maxOutputLines: number;
  maxAlternatives: number;
}

/**
 * Clipboard operation result
 */
export interface ClipboardResult {
  success: boolean;
  message: string;
}
