"use client";

import { ArrowRight, Filter, Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { Account, Contact, CustomFieldDefinition, Lead, Opportunity, OpportunityStage } from "@clientloop/domain";
import { opportunityStageOrder, seedManagerId } from "@clientloop/domain";
import {
  accountCreateInput,
  contactCreateInput,
  contactCreateValidationMessage,
  leadCreateInput,
  leadCreateValidationMessage,
  opportunityCreateInput,
  opportunityCreateValidationMessage,
  type AccountCreateDraft,
  type ContactCreateDraft,
  type LeadCreateDraft,
  type OpportunityCreateDraft
} from "../lib/create-record-inputs";
import type { CreatePermissions } from "../lib/session-permissions";
import { stageLabels } from "./workspace-model";
import { formatCurrency, formatCustomFieldValue, formatDate } from "./workspace-helpers";
import { CustomFieldBadges, StatusPill } from "./workspace-ui";

export function LeadCreateForm({
  busy,
  draft,
  onCancel,
  onChange,
  onSubmit
}: {
  busy: boolean;
  draft: LeadCreateDraft;
  onCancel: () => void;
  onChange: (draft: LeadCreateDraft) => void;
  onSubmit: () => void;
}) {
  const validationMessage = leadCreateValidationMessage(draft);

  return (
    <RecordCreatePanel
      formClassName="lead-create-form"
      title="lead"
      validationId="lead-create-validation"
      validationMessage={validationMessage}
    >
      <label>
        <span>Contact</span>
        <input
          value={draft.contactName}
          onChange={(event) => onChange({ ...draft, contactName: event.target.value })}
          placeholder="Taylor Nguyen"
        />
      </label>
      <label>
        <span>Company</span>
        <input
          value={draft.companyName}
          onChange={(event) => onChange({ ...draft, companyName: event.target.value })}
          placeholder="Acme Inc."
        />
      </label>
      <label>
        <span>Email</span>
        <input
          aria-describedby={validationMessage ? "lead-create-validation" : undefined}
          inputMode="email"
          value={draft.email}
          onChange={(event) => onChange({ ...draft, email: event.target.value })}
          placeholder="taylor@example.com"
        />
      </label>
      <label>
        <span>Source</span>
        <input
          value={draft.source}
          onChange={(event) => onChange({ ...draft, source: event.target.value })}
          placeholder="Referral"
        />
      </label>
      <RecordCreateActions
        busy={busy}
        disabled={Boolean(validationMessage) || !leadCreateInput(draft)}
        label="Create lead"
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </RecordCreatePanel>
  );
}

export function RecordCreatePanel({
  children,
  formClassName,
  title,
  validationId,
  validationMessage
}: {
  children: ReactNode;
  formClassName?: string;
  title: string;
  validationId?: string;
  validationMessage?: string;
}) {
  const formClasses = ["record-create-form", formClassName].filter(Boolean).join(" ");

  return (
    <section className="record-create-panel" aria-label={`Create ${title}`}>
      <div className="panel-heading small">
        <div>
          <p className="eyebrow">New</p>
          <h3>Create {title}</h3>
        </div>
      </div>
      <div className={formClasses}>{children}</div>
      {validationMessage ? (
        <p className="data-message error" id={validationId}>
          {validationMessage}
        </p>
      ) : null}
    </section>
  );
}

export function RecordCreateActions({
  busy,
  disabled,
  label,
  onCancel,
  onSubmit
}: {
  busy: boolean;
  disabled: boolean;
  label: string;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="record-create-actions">
      <button className="command-button" disabled={busy || disabled} onClick={onSubmit}>
        <Plus size={16} /> {label}
      </button>
      <button className="table-action" disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

export function LeadsView({
  convertingLeadId,
  leads,
  message,
  onConvert,
  onOpenRecord
}: {
  convertingLeadId: string | null;
  leads: Lead[];
  message: string;
  onConvert: (lead: Lead) => void;
  onOpenRecord: (lead: Lead) => void;
}) {
  return (
    <>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Leads</p>
          <h3>Qualification queue</h3>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Lead</th>
              <th scope="col">Company</th>
              <th scope="col">Source</th>
              <th scope="col">Status</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const canConvert = lead.status !== "converted" && lead.status !== "disqualified";
              return (
                <tr key={lead.id}>
                  <td>
                    <button className="link-button" onClick={() => onOpenRecord(lead)}>
                      {lead.contactName}
                    </button>
                    <p className="table-subtext">{lead.email ?? ""}</p>
                  </td>
                  <td>{lead.companyName ?? ""}</td>
                  <td>{lead.source}</td>
                  <td>
                    <StatusPill value={lead.status} />
                  </td>
                  <td>
                    <div className="card-actions">
                      <button className="table-action" onClick={() => onOpenRecord(lead)}>
                        Open
                      </button>
                      <button
                        className="table-action"
                        disabled={!canConvert || convertingLeadId === lead.id}
                        onClick={() => onConvert(lead)}
                      >
                        <ArrowRight size={16} /> Convert
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {message ? <p className="data-message">{message}</p> : null}
    </>
  );
}

export function PipelineView(props: {
  accountsById: Map<string, Account>;
  customFieldDefinitions: CustomFieldDefinition[];
  filteredOpportunities: Opportunity[];
  message: string;
  stageFilter: OpportunityStage | "all";
  syncingId: string | null;
  onAdvance: (opportunity: Opportunity) => void;
  onOpenRecord: (opportunity: Opportunity) => void;
  onStageFilter: (stage: OpportunityStage | "all") => void;
}) {
  return (
    <>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h3>Opportunities by stage</h3>
        </div>
        <div className="segmented" aria-label="Stage filter">
          <button
            className={props.stageFilter === "all" ? "selected" : ""}
            onClick={() => props.onStageFilter("all")}
          >
            <Filter size={15} /> All
          </button>
          {opportunityStageOrder.slice(0, 4).map((stage) => (
            <button
              key={stage}
              className={props.stageFilter === stage ? "selected" : ""}
              onClick={() => props.onStageFilter(stage)}
            >
              {stageLabels[stage]}
            </button>
          ))}
        </div>
      </div>

      <div className="pipeline-board">
        {opportunityStageOrder.slice(0, 5).map((stage) => {
          const stageOpportunities = props.filteredOpportunities.filter(
            (opportunity) => opportunity.stage === stage
          );
          const stageTotal = stageOpportunities.reduce(
            (sum, opportunity) => sum + (opportunity.amount ?? 0),
            0
          );

          return (
            <section className="stage-column" key={stage} aria-label={stageLabels[stage]}>
              <header>
                <span>{stageLabels[stage]}</span>
                <strong>{formatCurrency(stageTotal)}</strong>
              </header>
              <div className="opportunity-list">
                {stageOpportunities.map((opportunity) => (
                  <article className="record-card" key={opportunity.id}>
                    <div>
                      <h4>{opportunity.name}</h4>
                      <p>{props.accountsById.get(opportunity.accountId)?.name ?? "No account"}</p>
                    </div>
                    <div className="card-row">
                      <span>{formatCurrency(opportunity.amount ?? 0)}</span>
                      <span>{opportunity.probabilityPct ?? 0}%</span>
                    </div>
                    <CustomFieldBadges
                      definitions={props.customFieldDefinitions}
                      values={opportunity.customFields}
                    />
                    <div className="card-row">
                      <span>{formatDate(opportunity.expectedCloseDate)}</span>
                      <div className="card-actions">
                        <button
                          className="table-action"
                          onClick={() => props.onOpenRecord(opportunity)}
                        >
                          Open
                        </button>
                        <button
                          className="icon-button compact"
                          title="Advance stage"
                          aria-label={`Advance ${opportunity.name}`}
                          disabled={props.syncingId === opportunity.id}
                          onClick={() => props.onAdvance(opportunity)}
                        >
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                {stageOpportunities.length === 0 ? (
                  <div className="empty-state">No records</div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
      {props.message ? <p className="data-message">{props.message}</p> : null}
    </>
  );
}

export function OpportunityCreateForm({
  accounts,
  contacts,
  busy,
  draft,
  onCancel,
  onChange,
  onSubmit
}: {
  accounts: Account[];
  contacts: Contact[];
  busy: boolean;
  draft: OpportunityCreateDraft;
  onCancel: () => void;
  onChange: (draft: OpportunityCreateDraft) => void;
  onSubmit: () => void;
}) {
  const accountContacts = draft.accountId
    ? contacts.filter((contact) => contact.accountId === draft.accountId)
    : [];
  const validationMessage = opportunityCreateValidationMessage(draft);

  return (
    <RecordCreatePanel
      formClassName="opportunity-create-form"
      title="opportunity"
      validationMessage={validationMessage}
    >
      <label>
        <span>Opportunity</span>
        <input
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder="Expansion deal"
        />
      </label>
      <label>
        <span>Account</span>
        <select
          value={draft.accountId}
          onChange={(event) =>
            onChange({ ...draft, accountId: event.target.value, primaryContactId: "" })
          }
        >
          <option value="">Select account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Contact</span>
        <select
          value={draft.primaryContactId}
          disabled={!draft.accountId || accountContacts.length === 0}
          onChange={(event) => onChange({ ...draft, primaryContactId: event.target.value })}
        >
          <option value="">No primary contact</option>
          {accountContacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.firstName} {contact.lastName}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Stage</span>
        <select
          value={draft.stage}
          onChange={(event) =>
            onChange({ ...draft, stage: event.target.value as OpportunityStage })
          }
        >
          {opportunityStageOrder.slice(0, 4).map((stage) => (
            <option key={stage} value={stage}>
              {stageLabels[stage]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Amount</span>
        <input
          inputMode="decimal"
          value={draft.amount}
          onChange={(event) => onChange({ ...draft, amount: event.target.value })}
          placeholder="50000"
        />
      </label>
      <label>
        <span>Close date</span>
        <input
          type="date"
          value={draft.expectedCloseDate}
          onChange={(event) => onChange({ ...draft, expectedCloseDate: event.target.value })}
        />
      </label>
      <label>
        <span>Probability</span>
        <input
          inputMode="numeric"
          value={draft.probabilityPct}
          onChange={(event) => onChange({ ...draft, probabilityPct: event.target.value })}
          placeholder="40"
        />
      </label>
      <RecordCreateActions
        busy={busy}
        disabled={!opportunityCreateInput(draft, seedManagerId)}
        label="Create opportunity"
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </RecordCreatePanel>
  );
}

export function AccountCreateForm({
  busy,
  draft,
  onCancel,
  onChange,
  onSubmit
}: {
  busy: boolean;
  draft: AccountCreateDraft;
  onCancel: () => void;
  onChange: (draft: AccountCreateDraft) => void;
  onSubmit: () => void;
}) {
  return (
    <RecordCreatePanel title="account">
      <label>
        <span>Account</span>
        <input
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder="Acme Inc."
        />
      </label>
      <label>
        <span>Domain</span>
        <input
          value={draft.domain}
          onChange={(event) => onChange({ ...draft, domain: event.target.value })}
          placeholder="acme.example"
        />
      </label>
      <label>
        <span>Status</span>
        <select
          value={draft.status}
          onChange={(event) =>
            onChange({ ...draft, status: event.target.value as Account["status"] })
          }
        >
          <option value="prospect">Prospect</option>
          <option value="customer">Customer</option>
          <option value="partner">Partner</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <RecordCreateActions
        busy={busy}
        disabled={!accountCreateInput(draft)}
        label="Create account"
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </RecordCreatePanel>
  );
}

export function AccountsView({
  accounts,
  customFieldDefinitions,
  message,
  opportunities,
  onOpenRecord
}: {
  accounts: Account[];
  customFieldDefinitions: CustomFieldDefinition[];
  message: string;
  opportunities: Opportunity[];
  onOpenRecord: (account: Account) => void;
}) {
  return (
    <>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Accounts</p>
          <h3>Book of business</h3>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Account</th>
              <th scope="col">Status</th>
              <th scope="col">Domain</th>
              <th scope="col">Open pipeline</th>
              {customFieldDefinitions.map((definition) => (
                <th scope="col" key={definition.id}>{definition.label}</th>
              ))}
              <th scope="col">Detail</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const pipeline = opportunities
                .filter((opportunity) => opportunity.accountId === account.id)
                .reduce((sum, opportunity) => sum + (opportunity.amount ?? 0), 0);
              return (
                <tr key={account.id}>
                  <td>
                    <button className="link-button" onClick={() => onOpenRecord(account)}>
                      {account.name}
                    </button>
                  </td>
                  <td>
                    <StatusPill value={account.status} />
                  </td>
                  <td>{account.domain ?? ""}</td>
                  <td>{formatCurrency(pipeline)}</td>
                  {customFieldDefinitions.map((definition) => (
                    <td key={definition.id}>
                      {formatCustomFieldValue(account.customFields[definition.key])}
                    </td>
                  ))}
                  <td>
                    <button className="table-action" onClick={() => onOpenRecord(account)}>
                      Open
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {message ? <p className="data-message">{message}</p> : null}
    </>
  );
}

export function ContactCreateForm({
  accounts,
  busy,
  draft,
  onCancel,
  onChange,
  onSubmit
}: {
  accounts: Account[];
  busy: boolean;
  draft: ContactCreateDraft;
  onCancel: () => void;
  onChange: (draft: ContactCreateDraft) => void;
  onSubmit: () => void;
}) {
  const validationMessage = contactCreateValidationMessage(draft);

  return (
    <RecordCreatePanel
      formClassName="contact-create-form"
      title="contact"
      validationMessage={validationMessage}
    >
      <label>
        <span>First name</span>
        <input
          value={draft.firstName}
          onChange={(event) => onChange({ ...draft, firstName: event.target.value })}
          placeholder="Jordan"
        />
      </label>
      <label>
        <span>Last name</span>
        <input
          value={draft.lastName}
          onChange={(event) => onChange({ ...draft, lastName: event.target.value })}
          placeholder="Rivera"
        />
      </label>
      <label>
        <span>Email</span>
        <input
          value={draft.email}
          onChange={(event) => onChange({ ...draft, email: event.target.value })}
          placeholder="jordan@example.com"
        />
      </label>
      <label>
        <span>Phone</span>
        <input
          value={draft.phone}
          onChange={(event) => onChange({ ...draft, phone: event.target.value })}
          placeholder="+1 415 555 0199"
        />
      </label>
      <label>
        <span>Account</span>
        <select
          value={draft.accountId}
          onChange={(event) => onChange({ ...draft, accountId: event.target.value })}
        >
          <option value="">No account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
      <RecordCreateActions
        busy={busy}
        disabled={!contactCreateInput(draft)}
        label="Create contact"
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </RecordCreatePanel>
  );
}

export function ContactsView({
  contacts,
  accountsById,
  customFieldDefinitions,
  message,
  onOpenRecord
}: {
  contacts: Contact[];
  accountsById: Map<string, Account>;
  customFieldDefinitions: CustomFieldDefinition[];
  message: string;
  onOpenRecord: (contact: Contact) => void;
}) {
  return (
    <>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Contacts</p>
          <h3>Relationship map</h3>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Phone</th>
              <th scope="col">Account</th>
              {customFieldDefinitions.map((definition) => (
                <th scope="col" key={definition.id}>{definition.label}</th>
              ))}
              <th scope="col">Detail</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id}>
                <td>
                  <button className="link-button" onClick={() => onOpenRecord(contact)}>
                    {contact.firstName} {contact.lastName}
                  </button>
                </td>
                <td>{contact.email ?? ""}</td>
                <td>{contact.phone ?? ""}</td>
                <td>{contact.accountId ? accountsById.get(contact.accountId)?.name ?? "" : ""}</td>
                {customFieldDefinitions.map((definition) => (
                  <td key={definition.id}>
                    {formatCustomFieldValue(contact.customFields[definition.key])}
                  </td>
                ))}
                <td>
                  <button className="table-action" onClick={() => onOpenRecord(contact)}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message ? <p className="data-message">{message}</p> : null}
    </>
  );
}
