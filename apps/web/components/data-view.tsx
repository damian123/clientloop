"use client";

import { Download, Plus, Search, Upload } from "lucide-react";
import type {
  AccountImportPreview,
  ContactImportPreview,
  ExportEntity,
  OpportunityImportPreview
} from "@clientloop/contracts";
import type { CustomFieldDefinition, CustomFieldType, RecordEntityType } from "@clientloop/domain";
import type { CustomFieldPermissions, DataPermissions } from "../lib/session-permissions";
import type {
  CustomFieldDraft,
  ImportPreviewSummary
} from "./workspace-model";
import {
  accountCsvPlaceholder,
  contactCsvPlaceholder,
  opportunityCsvPlaceholder
} from "./workspace-model";
import { customFieldDefinitionInput, isSelectField, normalizeKey } from "./workspace-helpers";
import { StatusPill } from "./workspace-ui";

export function DataView({
  accountCsv,
  contactCsv,
  opportunityCsv,
  customFieldDefinitions,
  customFieldDraft,
  dataBusy,
  dataMessage,
  dataPermissions,
  customFieldPermissions,
  accountImportPreview,
  importPreview,
  opportunityImportPreview,
  onAccountCsvChange,
  onContactCsvChange,
  onOpportunityCsvChange,
  onCreateCustomField,
  onCustomFieldDraftChange,
  onExport,
  onImportAccounts,
  onImport,
  onImportOpportunities,
  onPreviewAccounts,
  onPreview,
  onPreviewOpportunities
}: {
  accountCsv: string;
  contactCsv: string;
  opportunityCsv: string;
  customFieldDefinitions: CustomFieldDefinition[];
  customFieldDraft: CustomFieldDraft;
  dataBusy: boolean;
  dataMessage: string;
  dataPermissions: DataPermissions;
  customFieldPermissions: CustomFieldPermissions;
  accountImportPreview: AccountImportPreview | null;
  importPreview: ContactImportPreview | null;
  opportunityImportPreview: OpportunityImportPreview | null;
  onAccountCsvChange: (value: string) => void;
  onContactCsvChange: (value: string) => void;
  onOpportunityCsvChange: (value: string) => void;
  onCreateCustomField: () => void;
  onCustomFieldDraftChange: (value: CustomFieldDraft) => void;
  onExport: (entity: ExportEntity) => void;
  onImportAccounts: () => void;
  onImport: () => void;
  onImportOpportunities: () => void;
  onPreviewAccounts: () => void;
  onPreview: () => void;
  onPreviewOpportunities: () => void;
}) {
  return (
    <>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Data</p>
          <h3>Import and export</h3>
        </div>
      </div>

      <div className="data-workspace">
        <section className="data-section" aria-label="Exports">
          <div>
            <p className="eyebrow">Exports</p>
            <h4>Core records</h4>
          </div>
          <div className="data-actions">
            <button
              disabled={dataBusy || !dataPermissions.canExportAccounts}
              onClick={() => onExport("accounts")}
            >
              <Download size={16} /> Accounts
            </button>
            <button
              disabled={dataBusy || !dataPermissions.canExportContacts}
              onClick={() => onExport("contacts")}
            >
              <Download size={16} /> Contacts
            </button>
            <button
              disabled={dataBusy || !dataPermissions.canExportOpportunities}
              onClick={() => onExport("opportunities")}
            >
              <Download size={16} /> Opportunities
            </button>
          </div>
        </section>

        <ImportSection
          title="Account CSV"
          label="Account CSV"
          value={accountCsv}
          placeholder={accountCsvPlaceholder}
          busy={dataBusy}
          allowed={dataPermissions.canImportAccounts}
          preview={accountImportPreview}
          onChange={onAccountCsvChange}
          onPreview={onPreviewAccounts}
          onImport={onImportAccounts}
        />

        <ImportSection
          title="Contact CSV"
          label="Contact CSV"
          value={contactCsv}
          placeholder={contactCsvPlaceholder}
          busy={dataBusy}
          allowed={dataPermissions.canImportContacts}
          preview={importPreview}
          onChange={onContactCsvChange}
          onPreview={onPreview}
          onImport={onImport}
        />

        <ImportSection
          title="Opportunity CSV"
          label="Opportunity CSV"
          value={opportunityCsv}
          placeholder={opportunityCsvPlaceholder}
          busy={dataBusy}
          allowed={dataPermissions.canImportOpportunities}
          preview={opportunityImportPreview}
          onChange={onOpportunityCsvChange}
          onPreview={onPreviewOpportunities}
          onImport={onImportOpportunities}
        />

        <section className="data-section" aria-label="Custom field definitions">
          <div>
            <p className="eyebrow">Custom fields</p>
            <h4>Definitions</h4>
          </div>

          <div className="field-form">
            <label>
              <span>Entity</span>
              <select
                value={customFieldDraft.entityType}
                onChange={(event) =>
                  onCustomFieldDraftChange({
                    ...customFieldDraft,
                    entityType: event.target.value as RecordEntityType
                  })
                }
              >
                <option value="account">Account</option>
                <option value="contact">Contact</option>
                <option value="lead">Lead</option>
                <option value="opportunity">Opportunity</option>
              </select>
            </label>
            <label>
              <span>Label</span>
              <input
                value={customFieldDraft.label}
                onChange={(event) =>
                  onCustomFieldDraftChange({
                    ...customFieldDraft,
                    label: event.target.value,
                    key: customFieldDraft.key || normalizeKey(event.target.value)
                  })
                }
                placeholder="Renewal tier"
              />
            </label>
            <label>
              <span>Key</span>
              <input
                value={customFieldDraft.key}
                onChange={(event) =>
                  onCustomFieldDraftChange({
                    ...customFieldDraft,
                    key: normalizeKey(event.target.value)
                  })
                }
                placeholder="renewal_tier"
              />
            </label>
            <label>
              <span>Type</span>
              <select
                value={customFieldDraft.fieldType}
                onChange={(event) =>
                  onCustomFieldDraftChange({
                    ...customFieldDraft,
                    fieldType: event.target.value as CustomFieldType
                  })
                }
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="date">Date</option>
                <option value="single_select">Single select</option>
                <option value="multi_select">Multi select</option>
              </select>
            </label>
            <label className="field-options">
              <span>Options</span>
              <input
                value={customFieldDraft.options}
                onChange={(event) =>
                  onCustomFieldDraftChange({
                    ...customFieldDraft,
                    options: event.target.value
                  })
                }
                placeholder="gold, silver, bronze"
                disabled={!isSelectField(customFieldDraft.fieldType)}
              />
            </label>
            <label className="check-field">
              <input
                checked={customFieldDraft.required}
                onChange={(event) =>
                  onCustomFieldDraftChange({
                    ...customFieldDraft,
                    required: event.target.checked
                  })
                }
                type="checkbox"
              />
              <span>Required</span>
            </label>
            <label className="check-field">
              <input
                checked={customFieldDraft.isIndexed}
                onChange={(event) =>
                  onCustomFieldDraftChange({
                    ...customFieldDraft,
                    isIndexed: event.target.checked
                  })
                }
                type="checkbox"
              />
              <span>Indexed</span>
            </label>
            <button
              className="primary-action"
              disabled={
                dataBusy ||
                !customFieldPermissions.canCreateDefinitions ||
                customFieldDraft.label.trim().length === 0
              }
              onClick={onCreateCustomField}
            >
              <Plus size={16} /> Add field
            </button>
          </div>

          <div className="definition-list">
            {customFieldDefinitions.map((definition) => (
              <div className="definition-row" key={definition.id}>
                <strong>{definition.label}</strong>
                <span>{definition.entityType}</span>
                <code>{definition.key}</code>
                <StatusPill value={definition.fieldType} />
              </div>
            ))}
          </div>
        </section>

        {dataMessage ? <p className="data-message">{dataMessage}</p> : null}
      </div>
    </>
  );
}

export function ImportSection({
  title,
  label,
  value,
  placeholder,
  busy,
  allowed,
  preview,
  onChange,
  onPreview,
  onImport
}: {
  title: string;
  label: string;
  value: string;
  placeholder: string;
  busy: boolean;
  allowed: boolean;
  preview: ImportPreviewSummary | null;
  onChange: (value: string) => void;
  onPreview: () => void;
  onImport: () => void;
}) {
  return (
    <section className="data-section" aria-label={`${title} import`}>
      <div>
        <p className="eyebrow">Import</p>
        <h4>{title}</h4>
      </div>
      <label className="csv-editor">
        <span className="sr-only">{label}</span>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
        />
      </label>
      <div className="data-actions">
        <button disabled={busy || !allowed || value.trim().length === 0} onClick={onPreview}>
          <Search size={16} /> Preview
        </button>
        <button
          className="primary-action"
          disabled={busy || !allowed || !preview || preview.errors.length > 0}
          onClick={onImport}
        >
          <Upload size={16} /> Import
        </button>
      </div>

      {preview ? (
        <div className="import-summary" aria-label={`${title} import preview`}>
          <strong>{preview.validRows}</strong>
          <span>valid</span>
          <strong>{preview.errors.length}</strong>
          <span>errors</span>
          <strong>{preview.totalRows}</strong>
          <span>rows</span>
        </div>
      ) : null}

      {preview?.errors.length ? (
        <ul className="import-errors">
          {preview.errors.slice(0, 4).map((error) => (
            <li key={`${error.row}-${error.field}-${error.message}`}>
              Row {error.row}: {error.field} - {error.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
