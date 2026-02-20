/**
 * Tool registry for managing agent tool definitions
 */

import type { ZodObject, ZodOptional, ZodRawShape, ZodType } from 'zod';

import type { ToolDefinition } from './types.js';

interface JsonSchemaProperty {
  type: string;
  description?: string;
}

interface JsonSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
}

interface ProviderToolFormat {
  name: string;
  description: string;
  input_schema: JsonSchema;
}

/**
 * Convert a Zod object schema to a JSON Schema object
 */
function zodToJsonSchema(schema: ZodType): JsonSchema {
  const def = schema._def as { shape?: () => ZodRawShape; typeName?: string };
  if (def.typeName !== 'ZodObject' || !def.shape) {
    return { type: 'object', properties: {}, required: [] };
  }

  const shape = def.shape();
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const fieldDef = (fieldSchema as ZodType)._def as {
      typeName?: string;
      description?: string;
      innerType?: ZodType;
    };

    let isOptional = false;
    let innerDef = fieldDef;

    if (fieldDef.typeName === 'ZodOptional') {
      isOptional = true;
      innerDef = (fieldDef.innerType as ZodType)._def as typeof fieldDef;
    }

    const prop: JsonSchemaProperty = {
      type: mapZodType(innerDef.typeName),
    };
    if (innerDef.description) {
      prop.description = innerDef.description;
    }

    properties[key] = prop;
    if (!isOptional) {
      required.push(key);
    }
  }

  return { type: 'object', properties, required };
}

function mapZodType(typeName?: string): string {
  switch (typeName) {
    case 'ZodString':
      return 'string';
    case 'ZodNumber':
      return 'number';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodArray':
      return 'array';
    default:
      return 'string';
  }
}

/**
 * Registry that holds tool definitions and converts them for provider APIs
 */
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  toProviderFormat(): ProviderToolFormat[] {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: zodToJsonSchema(tool.inputSchema),
    }));
  }
}
