"use client";

import { Check, Pencil } from "lucide-react";
import type { SearchResult } from "@clientloop/contracts";
import type {
  CustomFieldDefinition,
  CustomFieldPrimitive,
  CustomFieldType,
  RecordEntityType
} from "@clientloop/domain";
import type { CustomFieldRecord, CustomFieldValueDrafts } from "./workspace-model";
import {
  customFieldOptions,
  draftCustomFieldValue,
  entityTypeLabel,
  formatCustomFieldValue,
  hasCustomFieldDraft,
  isSelectField,
  parseCustomFieldValue,
  recordDraftKey,
  searchResultId
} from "./workspace-helpers";

export function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-metric">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

export function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      <span aria-hidden="true">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

export function SearchResultsPanel({
  activeIndex,
  error,
  loading,
  query,
  results,
  onActiveIndexChange,
  onOpen
}: {
  activeIndex: number;
  error: string;
  loading: boolean;
  query: string;
  results: SearchResult[];
  onActiveIndexChange: (index: number) => void;
  onOpen: (result: SearchResult) => void;
}) {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2 || (!loading && !error && results.length === 0)) {
    return null;
  }

  return (
    <section
      className="search-results"
      id="global-search-results"
      aria-label="Search results"
    >
      {loading ? <p>Searching</p> : null}
      {error ? <p>{error}</p> : null}
      {!loading && !error && results.length === 0 ? <p>No matching records</p> : null}
      {results.length > 0 ? (
        <div>
          {results.map((result, index) => (
            <button
              key={`${result.type}:${result.id}`}
              id={searchResultId(result)}
              data-active={index === activeIndex ? "true" : undefined}
              onClick={() => onOpen(result)}
              onMouseEnter={() => onActiveIndexChange(index)}
            >
              <span>{entityTypeLabel(result.type)}</span>
              <strong>{result.label}</strong>
              {result.description ? <small>{result.description}</small> : null}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function StatusPill({ value }: { value: string }) {
  return <span className={`status-pill ${value}`}>{value.replace("_", " ")}</span>;
}

export function CustomFieldBadges({
  definitions,
  values
}: {
  definitions: CustomFieldDefinition[];
  values: Record<string, CustomFieldPrimitive>;
}) {
  const visibleValues = definitions
    .map((definition) => ({
      definition,
      value: values[definition.key]
    }))
    .filter((item) => item.value !== undefined && item.value !== null && item.value !== "");

  if (visibleValues.length === 0) {
    return null;
  }

  return (
    <div className="field-badges">
      {visibleValues.slice(0, 2).map(({ definition, value }) => (
        <span key={definition.id}>{definition.label}: {formatCustomFieldValue(value)}</span>
      ))}
    </div>
  );
}

export function CustomFieldValueEditor({
  definitions,
  drafts,
  entityType,
  record,
  savingRecordId,
  canUpdate,
  onDraftChange,
  onSave
}: {
  definitions: CustomFieldDefinition[];
  drafts: CustomFieldValueDrafts;
  entityType: RecordEntityType;
  record: CustomFieldRecord;
  savingRecordId: string | null;
  canUpdate: boolean;
  onDraftChange: (
    entityType: RecordEntityType,
    recordId: string,
    fieldKey: string,
    value: string
  ) => void;
  onSave: (
    entityType: RecordEntityType,
    record: CustomFieldRecord,
    definitions: CustomFieldDefinition[]
  ) => void;
}) {
  if (definitions.length === 0) {
    return null;
  }

  const draftKey = recordDraftKey(entityType, record.id);
  const hasDraft = hasCustomFieldDraft(drafts, draftKey);

  return (
    <div className="field-editor">
      {definitions.map((definition) => (
        <label key={definition.id}>
          <span>{definition.label}</span>
          <CustomFieldInput
            definition={definition}
            disabled={!canUpdate}
            value={draftCustomFieldValue(drafts, record, definition, entityType)}
            onChange={(value) => onDraftChange(entityType, record.id, definition.key, value)}
          />
        </label>
      ))}
      <button
        className="table-action"
        disabled={!canUpdate || !hasDraft || savingRecordId === draftKey}
        onClick={() => onSave(entityType, record, definitions)}
      >
        <Check size={16} /> Save fields
      </button>
    </div>
  );
}

export function CustomFieldInput({
  definition,
  disabled,
  value,
  onChange
}: {
  definition: CustomFieldDefinition;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = customFieldOptions(definition);

  if (definition.fieldType === "boolean") {
    return (
      <select
        className="field-input"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Unset</option>
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    );
  }

  if (definition.fieldType === "single_select" && options.length > 0) {
    return (
      <select
        className="field-input"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Unset</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      className="field-input"
      disabled={disabled}
      type={definition.fieldType === "number" ? "number" : definition.fieldType === "date" ? "date" : "text"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={definition.fieldType === "multi_select" ? "value, value" : undefined}
    />
  );
}
