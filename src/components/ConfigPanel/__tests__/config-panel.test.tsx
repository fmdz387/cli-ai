/**
 * Config Panel — comprehensive tests
 *
 * Tests the full config panel: rendering, tab navigation, item selection,
 * provider switching, model selection, custom model editing, toggles,
 * API key flow, and about section. Uses real component rendering via
 * Ink's test renderer so we exercise the actual React tree.
 */
import {
  CUSTOM_MODEL_OPTION,
  PROVIDER_MODELS,
  type ConfigSection,
} from '../../../commands/types.js';
import { AI_PROVIDERS, PROVIDER_CONFIG, VERSION } from '../../../constants.js';
import type { AppConfig } from '../../../types/index.js';
import { ConfigPanelDisplay, type StorageInfo } from '../ConfigPanelDisplay.js';

import { render } from 'ink-testing-library';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock secure-storage so `hasApiKey` is controlled per test
const hasApiKeyMock = vi.fn<(provider: string) => boolean>().mockReturnValue(false);

vi.mock('../../../lib/secure-storage.js', () => ({
  hasApiKey: (p: string) => hasApiKeyMock(p),
  getApiKey: () => null,
  getConfig: () => ({}),
  setConfig: () => {},
  getStorageInfo: () => ({
    method: 'none' as const,
    secure: false,
    description: 'Not configured',
  }),
}));

// Mock theme
vi.mock('../../../theme/index.js', () => ({
  useTheme: () => ({
    background: '#1e1e2e',
    backgroundPanel: '#313244',
    backgroundElement: '#45475a',
    text: '#cdd6f4',
    textMuted: '#6c7086',
    primary: '#cba6f7',
    secondary: '#89b4fa',
    accent: '#f5c2e7',
    error: '#f38ba8',
    warning: '#fab387',
    success: '#a6e3a1',
    info: '#89b4fa',
    border: '#585b70',
    borderActive: '#cba6f7',
    syntaxKeyword: '#cba6f7',
    syntaxString: '#a6e3a1',
    syntaxVariable: '#89b4fa',
    syntaxFlag: '#fab387',
    syntaxPipe: '#f38ba8',
    syntaxPath: '#f5c2e7',
    markdownHeading: '#cba6f7',
    markdownLink: '#89b4fa',
    markdownCode: '#a6e3a1',
    markdownBlockquote: '#6c7086',
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_TOGGLES = {
  contextEnabled: true,
  showExplanations: true,
  syntaxHighlighting: true,
  simpleMode: false,
};

const DEFAULT_STORAGE: StorageInfo = {
  method: 'none',
  secure: false,
  description: 'Not configured',
};

function defaultConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    maxHistoryEntries: 5,
    maxOutputLines: 10,
    maxAlternatives: 3,
    contextEnabled: true,
    ...overrides,
  };
}

interface RenderOpts {
  section?: ConfigSection;
  itemIndex?: number;
  config?: Partial<AppConfig>;
  toggles?: Partial<typeof DEFAULT_TOGGLES>;
  storageInfo?: StorageInfo;
  maskedKey?: string | null;
  isEditingCustomModel?: boolean;
  customModelState?: { value: string; cursorOffset: number };
}

function renderPanel(opts: RenderOpts = {}) {
  const config = defaultConfig(opts.config);
  const instance = render(
    <ConfigPanelDisplay
      visible={true}
      activeSection={opts.section ?? 'provider'}
      sectionItemIndex={opts.itemIndex ?? 0}
      config={config}
      hasApiKey={hasApiKeyMock(config.provider)}
      storageInfo={opts.storageInfo ?? DEFAULT_STORAGE}
      maskedKey={opts.maskedKey ?? null}
      toggles={{ ...DEFAULT_TOGGLES, ...opts.toggles }}
      isEditingCustomModel={opts.isEditingCustomModel}
      customModelState={opts.customModelState}
    />,
  );
  return instance;
}

function output(instance: ReturnType<typeof render>): string {
  return instance.lastFrame() ?? '';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  hasApiKeyMock.mockReset().mockReturnValue(false);
});

// ===== Visibility =====

describe('visibility', () => {
  it('renders nothing when visible=false', () => {
    const inst = render(
      <ConfigPanelDisplay
        visible={false}
        activeSection='provider'
        sectionItemIndex={0}
        config={defaultConfig()}
        hasApiKey={false}
        storageInfo={DEFAULT_STORAGE}
        maskedKey={null}
        toggles={DEFAULT_TOGGLES}
      />,
    );
    expect(output(inst)).toBe('');
  });

  it('renders the panel when visible=true', () => {
    const out = output(renderPanel());
    expect(out).toContain('Settings');
  });
});

// ===== Header =====

describe('header', () => {
  it('shows Settings title', () => {
    expect(output(renderPanel())).toContain('Settings');
  });

  it('shows Esc hint', () => {
    expect(output(renderPanel())).toContain('Esc to close');
  });
});

// ===== Tab bar =====

describe('tab bar', () => {
  it('renders all 5 tab labels', () => {
    const out = output(renderPanel());
    expect(out).toContain('Provider');
    expect(out).toContain('Model');
    expect(out).toContain('API Keys');
    expect(out).toContain('Options');
    expect(out).toContain('About');
  });

  it('renders tab number keys', () => {
    const out = output(renderPanel());
    // Middle dot separator between number and label
    for (const n of ['1', '2', '3', '4', '5']) {
      expect(out).toContain(n);
    }
  });
});

// ===== Provider tab =====

describe('provider tab', () => {
  it('shows all three providers', () => {
    const out = output(renderPanel({ section: 'provider' }));
    expect(out).toContain('Anthropic');
    expect(out).toContain('OpenRouter');
    expect(out).toContain('OpenAI');
  });

  it('shows section description', () => {
    const out = output(renderPanel({ section: 'provider' }));
    expect(out).toContain('Select your AI provider');
  });

  it('marks the selected provider with filled circle', () => {
    const out = output(renderPanel({ section: 'provider', config: { provider: 'anthropic' } }));
    // Should have ● for anthropic (selected) and ○ for others
    expect(out).toContain('\u25CF');
    expect(out).toContain('\u25CB');
  });

  it('shows focus cursor on first item by default', () => {
    const out = output(renderPanel({ section: 'provider', itemIndex: 0 }));
    // First item should have ">" cursor
    const lines = out.split('\n');
    const anthropicLine = lines.find((l) => l.includes('Anthropic'));
    expect(anthropicLine).toContain('>');
  });

  it('moves focus cursor to second item', () => {
    const out = output(renderPanel({ section: 'provider', itemIndex: 1 }));
    const lines = out.split('\n');
    const openRouterLine = lines.find((l) => l.includes('OpenRouter'));
    expect(openRouterLine).toContain('>');
    // First item should NOT have cursor
    const anthropicLine = lines.find((l) => l.includes('Anthropic'));
    expect(anthropicLine).not.toMatch(/>\s/);
  });

  it('shows key status for each provider', () => {
    hasApiKeyMock.mockImplementation((p: string) => p === 'anthropic');
    const out = output(renderPanel({ section: 'provider' }));
    expect(out).toContain('\u2713 Key');
    expect(out).toContain('\u2717 No key');
  });

  it('shows checkmark for provider with key set', () => {
    hasApiKeyMock.mockReturnValue(true);
    const out = output(renderPanel({ section: 'provider' }));
    // All three should show ✓
    const matches = out.match(/\u2713 Key/g);
    expect(matches?.length).toBe(3);
  });
});

// ===== Model tab =====

describe('model tab', () => {
  it('shows models for current provider (anthropic)', () => {
    const out = output(renderPanel({ section: 'model', config: { provider: 'anthropic' } }));
    expect(out).toContain('Claude Sonnet 4.5');
    expect(out).toContain('Claude Opus 4.5');
    expect(out).toContain('Claude Haiku 4.5');
  });

  it('shows models for openrouter', () => {
    const out = output(
      renderPanel({
        section: 'model',
        config: { provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' },
      }),
    );
    expect(out).toContain('MiMo-V2-Flash');
    expect(out).toContain('Grok Code Fast 1');
    expect(out).toContain('Gemini 3 Flash Preview');
  });

  it('shows models for openai', () => {
    const out = output(
      renderPanel({
        section: 'model',
        config: { provider: 'openai', model: 'gpt-5.2' },
      }),
    );
    expect(out).toContain('GPT-5.2');
    expect(out).toContain('GPT-5 Mini');
    expect(out).toContain('GPT-5 Nano');
  });

  it('shows description text with provider name', () => {
    const out = output(renderPanel({ section: 'model', config: { provider: 'anthropic' } }));
    expect(out).toContain('Choose a model for Anthropic');
  });

  it('marks the selected model', () => {
    const out = output(
      renderPanel({ section: 'model', config: { model: 'claude-sonnet-4-5' } }),
    );
    // The selected model line should have ●
    const lines = out.split('\n');
    const sonnetLine = lines.find((l) => l.includes('Claude Sonnet 4.5'));
    expect(sonnetLine).toContain('\u25CF');
    // Another model should have ○
    const opusLine = lines.find((l) => l.includes('Claude Opus 4.5'));
    expect(opusLine).toContain('\u25CB');
  });

  it('shows Custom model option', () => {
    const out = output(renderPanel({ section: 'model' }));
    expect(out).toContain(CUSTOM_MODEL_OPTION.name);
  });

  it('shows model descriptions', () => {
    const out = output(renderPanel({ section: 'model' }));
    expect(out).toContain('Fast and capable');
    expect(out).toContain('Most capable');
    expect(out).toContain('Fastest');
  });

  it('shows custom model as selected when model is not in the list', () => {
    const out = output(
      renderPanel({
        section: 'model',
        config: { model: 'my-custom-model-xyz' },
      }),
    );
    const lines = out.split('\n');
    const customLine = lines.find((l) => l.includes('Custom model'));
    expect(customLine).toContain('\u25CF');
    expect(out).toContain('my-custom-model-xyz');
  });

  it('focuses correct item by index', () => {
    // Index 1 = second model (Opus)
    const out = output(renderPanel({ section: 'model', itemIndex: 1 }));
    const lines = out.split('\n');
    const opusLine = lines.find((l) => l.includes('Claude Opus 4.5'));
    expect(opusLine).toContain('>');
  });

  it('focuses custom model option at last index', () => {
    const models = PROVIDER_MODELS['anthropic'];
    const customIdx = models.length; // 3
    const out = output(renderPanel({ section: 'model', itemIndex: customIdx }));
    const lines = out.split('\n');
    const customLine = lines.find((l) => l.includes('Custom model'));
    expect(customLine).toContain('>');
  });
});

// ===== Custom model editing =====

describe('custom model editing', () => {
  it('shows text input when editing', () => {
    const models = PROVIDER_MODELS['anthropic'];
    const customIdx = models.length;
    const out = output(
      renderPanel({
        section: 'model',
        itemIndex: customIdx,
        isEditingCustomModel: true,
        customModelState: { value: 'my-model', cursorOffset: 8 },
      }),
    );
    expect(out).toContain('my-model');
  });

  it('shows save/cancel hint when editing', () => {
    const models = PROVIDER_MODELS['anthropic'];
    const customIdx = models.length;
    const out = output(
      renderPanel({
        section: 'model',
        itemIndex: customIdx,
        isEditingCustomModel: true,
        customModelState: { value: '', cursorOffset: 0 },
      }),
    );
    expect(out).toContain('Enter save');
    expect(out).toContain('Esc cancel');
  });

  it('shows editing-mode footer hint', () => {
    const models = PROVIDER_MODELS['anthropic'];
    const customIdx = models.length;
    const out = output(
      renderPanel({
        section: 'model',
        itemIndex: customIdx,
        isEditingCustomModel: true,
        customModelState: { value: '', cursorOffset: 0 },
      }),
    );
    expect(out).toContain('Enter Save');
    expect(out).toContain('Esc Cancel');
  });
});

// ===== API Keys tab =====

describe('api keys tab', () => {
  it('shows all three providers', () => {
    const out = output(renderPanel({ section: 'api-keys' }));
    expect(out).toContain('Anthropic');
    expect(out).toContain('OpenRouter');
    expect(out).toContain('OpenAI');
  });

  it('shows section description', () => {
    const out = output(renderPanel({ section: 'api-keys' }));
    expect(out).toContain('Manage API keys for each provider');
  });

  it('shows Configured status when key exists', () => {
    hasApiKeyMock.mockImplementation((p: string) => p === 'anthropic');
    const out = output(renderPanel({ section: 'api-keys' }));
    expect(out).toContain('\u2713 Configured');
  });

  it('shows Not set status when no key', () => {
    hasApiKeyMock.mockReturnValue(false);
    const out = output(renderPanel({ section: 'api-keys' }));
    expect(out).toContain('\u2717 Not set');
  });

  it('shows Enter to add for missing key', () => {
    hasApiKeyMock.mockReturnValue(false);
    const out = output(renderPanel({ section: 'api-keys' }));
    expect(out).toContain('Enter to add');
  });

  it('shows Enter to change for existing key', () => {
    hasApiKeyMock.mockReturnValue(true);
    const out = output(renderPanel({ section: 'api-keys' }));
    expect(out).toContain('Enter to change');
  });

  it('focuses correct item', () => {
    const out = output(renderPanel({ section: 'api-keys', itemIndex: 2 }));
    const lines = out.split('\n');
    const openaiLine = lines.find((l) => l.includes('OpenAI'));
    expect(openaiLine).toContain('>');
  });
});

// ===== Options tab =====

describe('options tab', () => {
  it('shows section description', () => {
    const out = output(renderPanel({ section: 'options' }));
    expect(out).toContain('Customize your experience');
  });

  it('shows all four toggle labels', () => {
    const out = output(renderPanel({ section: 'options' }));
    expect(out).toContain('Context');
    expect(out).toContain('Explanations');
    expect(out).toContain('Syntax highlighting');
    expect(out).toContain('Simple mode');
  });

  it('shows toggle descriptions', () => {
    const out = output(renderPanel({ section: 'options' }));
    expect(out).toContain('Pass conversation history to AI');
    expect(out).toContain('Show command explanations');
    expect(out).toContain('Highlight command syntax');
    expect(out).toContain('Minimal interface');
  });

  it('shows checked state for enabled toggles', () => {
    const out = output(
      renderPanel({
        section: 'options',
        toggles: {
          contextEnabled: true,
          showExplanations: true,
          syntaxHighlighting: false,
          simpleMode: false,
        },
      }),
    );
    // ✓ for enabled, space for disabled
    const checkCount = (out.match(/\[\u2713\]/g) ?? []).length;
    const uncheckCount = (out.match(/\[ \]/g) ?? []).length;
    expect(checkCount).toBe(2);
    expect(uncheckCount).toBe(2);
  });

  it('shows all checked when all enabled', () => {
    const out = output(
      renderPanel({
        section: 'options',
        toggles: {
          contextEnabled: true,
          showExplanations: true,
          syntaxHighlighting: true,
          simpleMode: true,
        },
      }),
    );
    const checkCount = (out.match(/\[\u2713\]/g) ?? []).length;
    expect(checkCount).toBe(4);
  });

  it('shows all unchecked when all disabled', () => {
    const out = output(
      renderPanel({
        section: 'options',
        toggles: {
          contextEnabled: false,
          showExplanations: false,
          syntaxHighlighting: false,
          simpleMode: false,
        },
      }),
    );
    const uncheckCount = (out.match(/\[ \]/g) ?? []).length;
    expect(uncheckCount).toBe(4);
  });

  it('focuses correct toggle by index', () => {
    const out = output(renderPanel({ section: 'options', itemIndex: 2 }));
    const lines = out.split('\n');
    const syntaxLine = lines.find((l) => l.includes('Syntax highlighting'));
    expect(syntaxLine).toContain('>');
  });
});

// ===== About tab =====

describe('about tab', () => {
  it('shows section description', () => {
    const out = output(renderPanel({ section: 'about' }));
    expect(out).toContain('Application information');
  });

  it('shows version', () => {
    const out = output(renderPanel({ section: 'about' }));
    expect(out).toContain(`CLI AI v${VERSION}`);
  });

  it('shows current provider name', () => {
    const out = output(renderPanel({ section: 'about', config: { provider: 'openrouter' } }));
    expect(out).toContain('OpenRouter');
  });

  it('shows current model id', () => {
    const out = output(
      renderPanel({ section: 'about', config: { model: 'claude-opus-4-5' } }),
    );
    expect(out).toContain('claude-opus-4-5');
  });

  it('shows storage info', () => {
    const out = output(
      renderPanel({
        section: 'about',
        storageInfo: { method: 'keyring', secure: true, description: 'System keyring' },
      }),
    );
    expect(out).toContain('System keyring');
  });

  it('shows storage not configured', () => {
    const out = output(renderPanel({ section: 'about' }));
    expect(out).toContain('Not configured');
  });
});

// ===== Footer hints =====

describe('footer', () => {
  it('shows navigation hints in normal mode', () => {
    const out = output(renderPanel({ section: 'provider' }));
    expect(out).toContain('Tab');
    expect(out).toContain('Navigate');
    expect(out).toContain('Select');
    expect(out).toContain('Close');
  });

  it('shows editing hints in custom model mode', () => {
    const models = PROVIDER_MODELS['anthropic'];
    const customIdx = models.length;
    const out = output(
      renderPanel({
        section: 'model',
        itemIndex: customIdx,
        isEditingCustomModel: true,
        customModelState: { value: '', cursorOffset: 0 },
      }),
    );
    expect(out).toContain('Enter Save');
    expect(out).toContain('Esc Cancel');
    // Should NOT show Tab/Navigate hints
    expect(out).not.toContain('Navigate');
  });
});

// ===== Tab exclusivity — only active tab content renders =====

describe('tab exclusivity', () => {
  it('provider tab does NOT show model list', () => {
    const out = output(renderPanel({ section: 'provider' }));
    // Should not contain the model description text
    expect(out).not.toContain('Choose a model for');
    expect(out).not.toContain('Custom model...');
  });

  it('model tab does NOT show provider key status', () => {
    const out = output(renderPanel({ section: 'model' }));
    expect(out).not.toContain('Select your AI provider');
  });

  it('api-keys tab does NOT show toggle checkboxes', () => {
    const out = output(renderPanel({ section: 'api-keys' }));
    expect(out).not.toContain('Customize your experience');
  });

  it('options tab does NOT show version info', () => {
    const out = output(renderPanel({ section: 'options' }));
    expect(out).not.toContain(`CLI AI v${VERSION}`);
  });

  it('about tab does NOT show navigation cursor', () => {
    const out = output(renderPanel({ section: 'about' }));
    // About has no selectable items so no ">" cursor lines in the content area
    const lines = out.split('\n');
    const contentLines = lines.filter(
      (l) => l.includes('Version') || l.includes('Provider') || l.includes('Storage'),
    );
    for (const line of contentLines) {
      expect(line).not.toMatch(/>\s/);
    }
  });
});

// ===== ConfigSection type =====

describe('ConfigSection type coverage', () => {
  const ALL_SECTIONS: ConfigSection[] = ['provider', 'model', 'api-keys', 'options', 'about'];

  it.each(ALL_SECTIONS)('renders without error for section=%s', (section) => {
    const inst = renderPanel({ section });
    const out = output(inst);
    // Every section should render the Settings header
    expect(out).toContain('Settings');
    // Every section should render the tab bar
    expect(out).toContain('Provider');
  });
});

// ===== Provider-model correspondence =====

describe('provider-model correspondence', () => {
  it.each(AI_PROVIDERS)('model tab shows correct models for provider=%s', (provider) => {
    const models = PROVIDER_MODELS[provider];
    const cfg = defaultConfig({ provider, model: models[0]?.id ?? '' });
    const out = output(
      renderPanel({
        section: 'model',
        config: { provider: cfg.provider, model: cfg.model },
      }),
    );
    for (const model of models) {
      expect(out).toContain(model.name);
    }
  });

  it.each(AI_PROVIDERS)('model tab description mentions %s name', (provider) => {
    const providerName = PROVIDER_CONFIG[provider].name;
    const models = PROVIDER_MODELS[provider];
    const out = output(
      renderPanel({
        section: 'model',
        config: { provider, model: models[0]?.id ?? '' },
      }),
    );
    expect(out).toContain(`Choose a model for ${providerName}`);
  });
});

// ===== Item count boundaries =====

describe('item count boundaries', () => {
  it('provider tab: focuses last provider', () => {
    const lastIndex = AI_PROVIDERS.length - 1; // 2 = OpenAI
    const out = output(renderPanel({ section: 'provider', itemIndex: lastIndex }));
    const lines = out.split('\n');
    const openaiLine = lines.find((l) => l.includes('OpenAI'));
    expect(openaiLine).toContain('>');
  });

  it('model tab: focuses last predefined model', () => {
    const models = PROVIDER_MODELS['anthropic'];
    const lastPredefIdx = models.length - 1;
    const out = output(renderPanel({ section: 'model', itemIndex: lastPredefIdx }));
    const lines = out.split('\n');
    const haikuLine = lines.find((l) => l.includes('Claude Haiku'));
    expect(haikuLine).toContain('>');
  });

  it('options tab: focuses last toggle', () => {
    const out = output(renderPanel({ section: 'options', itemIndex: 3 }));
    const lines = out.split('\n');
    const simpleLine = lines.find((l) => l.includes('Simple mode'));
    expect(simpleLine).toContain('>');
  });
});
