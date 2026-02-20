/**
 * Unit tests for ToolRegistry
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ToolRegistry } from '../registry.js';
import { defineTool } from '../types.js';

function makeTool(name: string) {
  return defineTool({
    name,
    description: `Test tool: ${name}`,
    inputSchema: z.object({ value: z.string() }),
    defaultPermission: 'allow',
    async execute() {
      return { kind: 'success' as const, output: 'ok' };
    },
  });
}

describe('ToolRegistry', () => {
  it('should register and retrieve a tool by name', () => {
    const registry = new ToolRegistry();
    const tool = makeTool('test_tool');
    registry.register(tool);
    expect(registry.get('test_tool')).toBe(tool);
  });

  it('should return undefined for unknown tool', () => {
    const registry = new ToolRegistry();
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('should list all registered tools', () => {
    const registry = new ToolRegistry();
    registry.register(makeTool('a'));
    registry.register(makeTool('b'));
    registry.register(makeTool('c'));
    expect(registry.list()).toHaveLength(3);
    expect(registry.list().map((t) => t.name)).toEqual(['a', 'b', 'c']);
  });

  it('should return correct provider format', () => {
    const registry = new ToolRegistry();
    registry.register(makeTool('my_tool'));
    const formats = registry.toProviderFormat();
    expect(formats).toHaveLength(1);
    expect(formats[0]!.name).toBe('my_tool');
    expect(formats[0]!.description).toBe('Test tool: my_tool');
    expect(formats[0]!.input_schema.type).toBe('object');
    expect(formats[0]!.input_schema.properties).toHaveProperty('value');
    expect(formats[0]!.input_schema.required).toContain('value');
  });

  it('should overwrite on duplicate registration', () => {
    const registry = new ToolRegistry();
    const tool1 = makeTool('dup');
    const tool2 = makeTool('dup');
    tool2.description = 'updated';
    registry.register(tool1);
    registry.register(tool2);
    expect(registry.list()).toHaveLength(1);
    expect(registry.get('dup')!.description).toBe('updated');
  });
});
