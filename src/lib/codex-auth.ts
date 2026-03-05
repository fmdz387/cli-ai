import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { exec } from 'node:child_process';
import { VERSION } from '../constants.js';

export const CODEX_CLIENT_ID = process.env.OPENAI_CODEX_CLIENT_ID ?? 'app_EMoamEEZ73f0CkXaXp7hrann';
export const CODEX_ISSUER = 'https://auth.openai.com';
export const CODEX_API_ENDPOINT = 'https://chatgpt.com/backend-api/codex/responses';
export const CODEX_OAUTH_PORT = 1455;
export const CODEX_REDIRECT_URI = `http://localhost:${CODEX_OAUTH_PORT}/auth/callback`;
export const CODEX_SCOPES = 'openid profile email offline_access';

export interface CodexTokenResponse {
  id_token: string;
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}

export interface CodexOAuthCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  accountId?: string;
}

export interface IdTokenClaims {
  chatgpt_account_id?: string;
  organizations?: Array<{ id: string }>;
  'https://api.openai.com/auth'?: {
    chatgpt_account_id?: string;
  };
}

export interface DeviceCodeInfo {
  userCode: string;
  verificationUrl: string;
}

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url').slice(0, 43);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function generateState(): string {
  return randomBytes(32).toString('base64url');
}

export function parseJwtClaims(token: string): IdTokenClaims | undefined {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return undefined;
    const payload = Buffer.from(parts[1]!, 'base64url').toString('utf-8');
    return JSON.parse(payload) as IdTokenClaims;
  } catch {
    return undefined;
  }
}

export function extractAccountId(tokens: CodexTokenResponse): string | undefined {
  const claims = parseJwtClaims(tokens.id_token);
  if (!claims) return undefined;
  return (
    claims.chatgpt_account_id ??
    claims['https://api.openai.com/auth']?.chatgpt_account_id ??
    claims.organizations?.[0]?.id
  );
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'win32' ? `start "" "${url}"` :
    process.platform === 'darwin' ? `open "${url}"` :
    `xdg-open "${url}"`;
  exec(cmd, () => {
    // Silently fail -- user can manually open the URL
  });
}

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<CodexTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: CODEX_CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const response = await fetch(`${CODEX_ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as CodexTokenResponse;
}

function tokensToCredentials(tokens: CodexTokenResponse): CodexOAuthCredentials {
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    accountId: extractAccountId(tokens),
  };
}

export function startBrowserOAuthFlow(): Promise<CodexOAuthCredentials> {
  return new Promise((resolve, reject) => {
    const { verifier, challenge } = generatePKCE();
    const state = generateState();
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('OAuth authorization timed out (5 minutes)'));
    }, 5 * 60 * 1000);

    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', `http://localhost:${CODEX_OAUTH_PORT}`);

      if (url.pathname === '/cancel') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Authorization Cancelled</h1></body></html>');
        clearTimeout(timeout);
        server.close();
        reject(new Error('Authorization cancelled by user'));
        return;
      }

      if (url.pathname !== '/auth/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html><body><h1>Authorization Failed</h1><p>${error}</p></body></html>`);
        clearTimeout(timeout);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (returnedState !== state) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Authorization Failed</h1><p>State mismatch (possible CSRF)</p></body></html>');
        clearTimeout(timeout);
        server.close();
        reject(new Error('OAuth state mismatch (possible CSRF attack)'));
        return;
      }

      if (!code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Authorization Failed</h1><p>No authorization code received</p></body></html>');
        clearTimeout(timeout);
        server.close();
        reject(new Error('No authorization code received'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Authorization Successful</h1><p>You can close this tab.</p><script>window.close()</script></body></html>');

      try {
        const tokens = await exchangeCodeForTokens(code, verifier, CODEX_REDIRECT_URI);
        const credentials = tokensToCredentials(tokens);
        clearTimeout(timeout);
        server.close();
        resolve(credentials);
      } catch (err) {
        clearTimeout(timeout);
        server.close();
        reject(err);
      }
    });

    server.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start OAuth server on port ${CODEX_OAUTH_PORT}: ${err.message}`));
    });

    server.listen(CODEX_OAUTH_PORT, () => {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: CODEX_CLIENT_ID,
        redirect_uri: CODEX_REDIRECT_URI,
        scope: CODEX_SCOPES,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        id_token_add_organizations: 'true',
        codex_cli_simplified_flow: 'true',
        originator: 'cli-ai',
      });
      const authorizeUrl = `${CODEX_ISSUER}/oauth/authorize?${params.toString()}`;
      openBrowser(authorizeUrl);
    });
  });
}

export async function startDeviceCodeFlow(
  onDeviceCode: (info: DeviceCodeInfo) => void,
): Promise<CodexOAuthCredentials> {
  const initResponse = await fetch(`${CODEX_ISSUER}/api/accounts/deviceauth/usercode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': `cli-ai/${VERSION}`,
    },
    body: JSON.stringify({ client_id: CODEX_CLIENT_ID }),
  });

  if (!initResponse.ok) {
    throw new Error(`Failed to initiate device authorization: ${initResponse.status}`);
  }

  const initData = (await initResponse.json()) as {
    device_auth_id: string;
    user_code: string;
    interval: string;
  };

  onDeviceCode({
    userCode: initData.user_code,
    verificationUrl: 'https://auth.openai.com/codex/device',
  });

  const pollInterval = Math.max(parseInt(initData.interval, 10), 1) * 1000 + 3000;
  const maxPollTime = 10 * 60 * 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxPollTime) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const pollResponse = await fetch(`${CODEX_ISSUER}/api/accounts/deviceauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `cli-ai/${VERSION}`,
      },
      body: JSON.stringify({
        device_auth_id: initData.device_auth_id,
        user_code: initData.user_code,
      }),
    });

    if (pollResponse.status === 403 || pollResponse.status === 404) {
      continue;
    }

    if (!pollResponse.ok) {
      throw new Error(`Device authorization failed: ${pollResponse.status}`);
    }

    const pollData = (await pollResponse.json()) as {
      authorization_code: string;
      code_verifier: string;
    };

    const tokens = await exchangeCodeForTokens(
      pollData.authorization_code,
      pollData.code_verifier,
      'https://auth.openai.com/deviceauth/callback',
    );

    return tokensToCredentials(tokens);
  }

  throw new Error('Device authorization timed out (10 minutes)');
}

export async function refreshCodexToken(refreshToken: string): Promise<CodexOAuthCredentials> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CODEX_CLIENT_ID,
  });

  const response = await fetch(`${CODEX_ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
  }

  const tokens = (await response.json()) as CodexTokenResponse;
  return tokensToCredentials(tokens);
}
