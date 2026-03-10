import {
  buildModelCatalogIndex,
  getModelLookupKeys,
  resolveModelContextWindow,
} from '../model-catalog.js';

import { describe, expect, it } from 'vitest';

describe('buildModelCatalogIndex', () => {
  it('indexes provider-prefixed models from remote metadata', () => {
    const catalog = buildModelCatalogIndex({
      openrouter: {
        models: {
          'vendor/custom-model': {
            id: 'vendor/custom-model',
            limit: { context: 64_000 },
          },
        },
      },
    });

    expect(resolveModelContextWindow(catalog, 'openrouter', 'vendor/custom-model')).toBe(64_000);
  });

  it('creates anthropic aliases for dashed and dotted model ids', () => {
    const catalog = buildModelCatalogIndex({
      anthropic: {
        models: {
          'anthropic/claude-sonnet-4.5': {
            id: 'anthropic/claude-sonnet-4.5',
            limit: { context: 200_000 },
          },
        },
      },
    });

    expect(resolveModelContextWindow(catalog, 'anthropic', 'claude-sonnet-4-5')).toBe(200_000);
  });
});

describe('getModelLookupKeys', () => {
  it('includes provider-scoped and raw variants when helpful', () => {
    expect(getModelLookupKeys('openai', 'gpt-5.4')).toContain('openai/gpt-5.4');
    expect(getModelLookupKeys('openrouter', 'anthropic/claude-sonnet-4.5')).toContain(
      'claude-sonnet-4-5',
    );
  });
});
