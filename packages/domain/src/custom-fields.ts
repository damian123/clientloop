import type {
  CustomFieldDefinition,
  CustomFieldPrimitive,
  CustomFieldType
} from "./types";

export class CustomFieldValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomFieldValidationError";
  }
}

export function normalizeCustomFieldKey(labelOrKey: string): string {
  return labelOrKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function assertValidCustomFieldDefinition(definition: CustomFieldDefinition): void {
  if (!definition.key || definition.key !== normalizeCustomFieldKey(definition.key)) {
    throw new CustomFieldValidationError(
      `Custom field key "${definition.key}" must be lowercase snake_case`
    );
  }

  if (definition.required && definition.fieldType === "boolean") {
    return;
  }

  if (definition.required && !definition.label.trim()) {
    throw new CustomFieldValidationError("Required custom fields must have a label");
  }
}

export function validateCustomFieldValue(
  fieldType: CustomFieldType,
  value: CustomFieldPrimitive
): boolean {
  if (value === null) {
    return true;
  }

  switch (fieldType) {
    case "text":
    case "textarea":
    case "date":
    case "datetime":
    case "single_select":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "multi_select":
      return Array.isArray(value) && value.every((item) => typeof item === "string");
    case "currency":
      return (
        typeof value === "object" &&
        !Array.isArray(value) &&
        "amount" in value &&
        "currency" in value &&
        typeof value.amount === "number" &&
        typeof value.currency === "string"
      );
    case "user_ref":
    case "account_ref":
      return (
        typeof value === "object" &&
        !Array.isArray(value) &&
        "id" in value &&
        "label" in value &&
        typeof value.id === "string" &&
        typeof value.label === "string"
      );
    default:
      return false;
  }
}

export function validateCustomFields(
  definitions: CustomFieldDefinition[],
  values: Record<string, CustomFieldPrimitive>
): void {
  const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));

  for (const definition of definitions) {
    if (definition.required && !(definition.key in values)) {
      throw new CustomFieldValidationError(`Missing required custom field "${definition.key}"`);
    }
  }

  for (const [key, value] of Object.entries(values)) {
    const definition = definitionByKey.get(key);

    if (!definition) {
      throw new CustomFieldValidationError(`Unknown custom field "${key}"`);
    }

    if (!validateCustomFieldValue(definition.fieldType, value)) {
      throw new CustomFieldValidationError(`Invalid value for custom field "${key}"`);
    }
  }
}

export function validateCustomFieldPatch(
  definitions: CustomFieldDefinition[],
  values: Record<string, CustomFieldPrimitive>
): void {
  const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));

  for (const [key, value] of Object.entries(values)) {
    const definition = definitionByKey.get(key);

    if (!definition) {
      throw new CustomFieldValidationError(`Unknown custom field "${key}"`);
    }

    if (!validateCustomFieldValue(definition.fieldType, value)) {
      throw new CustomFieldValidationError(`Invalid value for custom field "${key}"`);
    }
  }
}
