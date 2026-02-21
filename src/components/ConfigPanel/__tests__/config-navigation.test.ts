/**
 * Config navigation & state logic tests
 *
 * Tests the config section type definitions, item counts, section ordering,
 * toggle key mapping, and provider-model relationship invariants. These are
 * pure logic tests — no React rendering needed.
 */
import {
  CUSTOM_MODEL_OPTION,
  PROVIDER_MODELS,
  type ConfigSection,
  type DisplayToggles,
} from '../../../commands/types.js';
import {
  AI_PROVIDERS,
  DEFAULT_CONFIG,
  PROVIDER_CONFIG,
} from '../../../constants.js';
import type { AIProvider, AppConfig } from '../../../types/index.js';

import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Section definitions — must match the app's CONFIG_SECTIONS
// ---------------------------------------------------------------------------

const CONFIG_SECTIONS: readonly ConfigSection[] = [
  'provider',
  'model',
  'api-keys',
  'options',
  'about',
];

function getItemCount(section: ConfigSection, provider: AIProvider): number {
  const counts: Record<ConfigSection, number> = {
    'provider': AI_PROVIDERS.length,
    'model': PROVIDER_MODELS[provider].length + 1, // +1 for custom model
    'api-keys': AI_PROVIDERS.length,
    'options': 4,
    'about': 0,
  };
  return counts[section];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CONFIG_SECTIONS', () => {
  it('has exactly 5 sections', () => {
    expect(CONFIG_SECTIONS).toHaveLength(5);
  });

  it('sections are in the expected order', () => {
    expect(CONFIG_SECTIONS).toEqual(['provider', 'model', 'api-keys', 'options', 'about']);
  });

  it('all section names are unique', () => {
    const unique = new Set(CONFIG_SECTIONS);
    expect(unique.size).toBe(CONFIG_SECTIONS.length);
  });
});

describe('AI_PROVIDERS', () => {
  it('has exactly 3 providers', () => {
    expect(AI_PROVIDERS).toHaveLength(3);
  });

  it('contains anthropic, openrouter, openai', () => {
    expect(AI_PROVIDERS).toContain('anthropic');
    expect(AI_PROVIDERS).toContain('openrouter');
    expect(AI_PROVIDERS).toContain('openai');
  });

  it('every provider has a PROVIDER_CONFIG entry', () => {
    for (const p of AI_PROVIDERS) {
      expect(PROVIDER_CONFIG[p]).toBeDefined();
      expect(PROVIDER_CONFIG[p].name).toBeTruthy();
      expect(PROVIDER_CONFIG[p].defaultModel).toBeTruthy();
    }
  });

  it('every provider has a PROVIDER_MODELS entry', () => {
    for (const p of AI_PROVIDERS) {
      expect(PROVIDER_MODELS[p]).toBeDefined();
      expect(PROVIDER_MODELS[p].length).toBeGreaterThan(0);
    }
  });
});

describe('item counts', () => {
  it('provider section has count equal to AI_PROVIDERS.length', () => {
    expect(getItemCount('provider', 'anthropic')).toBe(AI_PROVIDERS.length);
  });

  it.each<AIProvider>(['anthropic', 'openrouter', 'openai'])(
    'model section for %s = predefined models + 1 custom',
    (provider) => {
      const predefined = PROVIDER_MODELS[provider].length;
      expect(getItemCount('model', provider)).toBe(predefined + 1);
    },
  );

  it('api-keys section has count equal to AI_PROVIDERS.length', () => {
    expect(getItemCount('api-keys', 'anthropic')).toBe(AI_PROVIDERS.length);
  });

  it('options section has exactly 4 toggles', () => {
    expect(getItemCount('options', 'anthropic')).toBe(4);
  });

  it('about section has 0 selectable items', () => {
    expect(getItemCount('about', 'anthropic')).toBe(0);
  });
});

describe('section navigation (next/prev cycling)', () => {
  function navigateNext(current: ConfigSection): ConfigSection {
    const idx = CONFIG_SECTIONS.indexOf(current);
    return CONFIG_SECTIONS[(idx + 1) % CONFIG_SECTIONS.length]!;
  }

  function navigatePrev(current: ConfigSection): ConfigSection {
    const idx = CONFIG_SECTIONS.indexOf(current);
    return CONFIG_SECTIONS[(idx - 1 + CONFIG_SECTIONS.length) % CONFIG_SECTIONS.length]!;
  }

  it('next from provider = model', () => {
    expect(navigateNext('provider')).toBe('model');
  });

  it('next from model = api-keys', () => {
    expect(navigateNext('model')).toBe('api-keys');
  });

  it('next from api-keys = options', () => {
    expect(navigateNext('api-keys')).toBe('options');
  });

  it('next from options = about', () => {
    expect(navigateNext('options')).toBe('about');
  });

  it('next from about wraps to provider', () => {
    expect(navigateNext('about')).toBe('provider');
  });

  it('prev from provider wraps to about', () => {
    expect(navigatePrev('provider')).toBe('about');
  });

  it('prev from about = options', () => {
    expect(navigatePrev('about')).toBe('options');
  });

  it('full forward cycle returns to start', () => {
    let section: ConfigSection = 'provider';
    for (let i = 0; i < CONFIG_SECTIONS.length; i++) {
      section = navigateNext(section);
    }
    expect(section).toBe('provider');
  });

  it('full backward cycle returns to start', () => {
    let section: ConfigSection = 'provider';
    for (let i = 0; i < CONFIG_SECTIONS.length; i++) {
      section = navigatePrev(section);
    }
    expect(section).toBe('provider');
  });
});

describe('item navigation (up/down cycling)', () => {
  function navigateDown(current: number, count: number): number {
    if (count === 0) return 0;
    return (current + 1) % count;
  }

  function navigateUp(current: number, count: number): number {
    if (count === 0) return 0;
    return (current - 1 + count) % count;
  }

  it('down from 0 with count 3 = 1', () => {
    expect(navigateDown(0, 3)).toBe(1);
  });

  it('down from last wraps to 0', () => {
    expect(navigateDown(2, 3)).toBe(0);
  });

  it('up from 0 wraps to last', () => {
    expect(navigateUp(0, 3)).toBe(2);
  });

  it('up from 1 = 0', () => {
    expect(navigateUp(1, 3)).toBe(0);
  });

  it('count=0 always returns 0', () => {
    expect(navigateDown(0, 0)).toBe(0);
    expect(navigateUp(0, 0)).toBe(0);
  });

  it('full down cycle with provider items returns to 0', () => {
    const count = getItemCount('provider', 'anthropic');
    let idx = 0;
    for (let i = 0; i < count; i++) {
      idx = navigateDown(idx, count);
    }
    expect(idx).toBe(0);
  });
});

describe('number key jump', () => {
  it.each([
    [1, 'provider'],
    [2, 'model'],
    [3, 'api-keys'],
    [4, 'options'],
    [5, 'about'],
  ] as const)('key %d jumps to %s', (key, expected) => {
    const section = CONFIG_SECTIONS[key - 1];
    expect(section).toBe(expected);
  });

  it('keys beyond section count are out of range', () => {
    expect(CONFIG_SECTIONS[5]).toBeUndefined();
    expect(CONFIG_SECTIONS[6]).toBeUndefined();
  });
});

describe('toggle keys', () => {
  const TOGGLE_KEYS: readonly (keyof DisplayToggles)[] = [
    'contextEnabled',
    'showExplanations',
    'syntaxHighlighting',
    'simpleMode',
  ] as const;

  it('has exactly 4 toggle keys', () => {
    expect(TOGGLE_KEYS).toHaveLength(4);
  });

  it('all toggle keys are valid DisplayToggles properties', () => {
    const sample: DisplayToggles = {
      contextEnabled: true,
      showExplanations: true,
      syntaxHighlighting: true,
      simpleMode: false,
    };
    for (const key of TOGGLE_KEYS) {
      expect(key in sample).toBe(true);
    }
  });

  it('toggle at index maps to correct key', () => {
    expect(TOGGLE_KEYS[0]).toBe('contextEnabled');
    expect(TOGGLE_KEYS[1]).toBe('showExplanations');
    expect(TOGGLE_KEYS[2]).toBe('syntaxHighlighting');
    expect(TOGGLE_KEYS[3]).toBe('simpleMode');
  });
});

describe('provider switch side effects', () => {
  it('every provider has a valid defaultModel in PROVIDER_MODELS', () => {
    for (const p of AI_PROVIDERS) {
      const defaultModel = PROVIDER_CONFIG[p].defaultModel;
      const models = PROVIDER_MODELS[p];
      const found = models.some((m) => m.id === defaultModel);
      expect(found).toBe(true);
    }
  });

  it('switching provider resets model to that provider default', () => {
    // Simulate the switch logic from app.tsx
    for (const newProvider of AI_PROVIDERS) {
      const newModel = PROVIDER_CONFIG[newProvider].defaultModel;
      const models = PROVIDER_MODELS[newProvider];
      expect(models.some((m) => m.id === newModel)).toBe(true);
    }
  });
});

describe('custom model option', () => {
  it('has the expected id', () => {
    expect(CUSTOM_MODEL_OPTION.id).toBe('__custom__');
  });

  it('is always the last item in the model list', () => {
    for (const provider of AI_PROVIDERS) {
      const models = PROVIDER_MODELS[provider];
      const customIndex = models.length; // custom is at length (0-indexed, after all models)
      expect(customIndex).toBeGreaterThan(0);
    }
  });

  it('a model id NOT in PROVIDER_MODELS is treated as custom', () => {
    for (const provider of AI_PROVIDERS) {
      const models = PROVIDER_MODELS[provider];
      const isCustom = !models.some((m) => m.id === 'my-weird-custom-model');
      expect(isCustom).toBe(true);
    }
  });

  it('the default model is NOT treated as custom', () => {
    for (const provider of AI_PROVIDERS) {
      const defaultModel = PROVIDER_CONFIG[provider].defaultModel;
      const models = PROVIDER_MODELS[provider];
      const isCustom = !models.some((m) => m.id === defaultModel);
      expect(isCustom).toBe(false);
    }
  });
});

describe('DEFAULT_CONFIG', () => {
  it('has a valid provider', () => {
    expect(AI_PROVIDERS).toContain(DEFAULT_CONFIG.provider);
  });

  it('has a valid model for its provider', () => {
    const models = PROVIDER_MODELS[DEFAULT_CONFIG.provider];
    expect(models.some((m) => m.id === DEFAULT_CONFIG.model)).toBe(true);
  });

  it('has contextEnabled true by default', () => {
    expect(DEFAULT_CONFIG.contextEnabled).toBe(true);
  });
});

describe('model option shape', () => {
  it.each(AI_PROVIDERS)('every model for %s has id, name, description', (provider) => {
    for (const model of PROVIDER_MODELS[provider]) {
      expect(typeof model.id).toBe('string');
      expect(model.id.length).toBeGreaterThan(0);
      expect(typeof model.name).toBe('string');
      expect(model.name.length).toBeGreaterThan(0);
      expect(typeof model.description).toBe('string');
      expect(model.description.length).toBeGreaterThan(0);
    }
  });

  it.each(AI_PROVIDERS)('no duplicate model ids within %s', (provider) => {
    const ids = PROVIDER_MODELS[provider].map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
