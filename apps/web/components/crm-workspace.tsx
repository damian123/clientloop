"use client";

import {
  Activity,
  ArrowRight,
  Building2,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Database,
  Download,
  Filter,
  Plus,
  RefreshCcw,
  Search,
  Upload,
  UserPlus,
  UserRound
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ContactImportPreview,
  CreateCustomFieldDefinitionInput,
  DashboardResponse,
  ExportEntity,
  SessionResponse
} from "@clientloop/contracts";
import type {
  Account,
  Contact,
  CustomFieldDefinition,
  CustomFieldPrimitive,
  CustomFieldType,
  Lead,
  Opportunity,
  OpportunityStage,
  RecordEntityType,
  Task
} from "@clientloop/domain";
import { opportunityStageOrder, seedManagerId, seedTenantId } from "@clientloop/domain";
import { CRMClient, CRMClientError } from "@clientloop/ui-sdk";

type ViewMode = "pipeline" | "leads" | "accounts" | "contacts" | "data";
type CustomFieldDraft = {
  entityType: RecordEntityType;
  label: string;
  key: string;
  fieldType: CustomFieldType;
  required: boolean;
  isIndexed: boolean;
  options: string;
};
type CustomFieldRecord = Account | Contact | Lead | Opportunity;
type CustomFieldValueDrafts = Record<string, Record<string, string>>;

const stageLabels: Record<OpportunityStage, string> = {
  qualification: "Qualification",
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed won",
  closed_lost: "Closed lost"
};

const contactCsvPlaceholder = `firstName,lastName,email,phone
Jordan,Rivera,jordan@example.com,+1 415 555 0199`;

export function CRMWorkspace({ initialDashboard }: { initialDashboard: DashboardResponse }) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [viewMode, setViewMode] = useState<ViewMode>("pipeline");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<OpportunityStage | "all">("all");
  const [accounts, setAccounts] = useState<Account[]>(initialDashboard.accounts);
  const [leads, setLeads] = useState<Lead[]>(initialDashboard.leads);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(
    initialDashboard.opportunities
  );
  const [contacts, setContacts] = useState<Contact[]>(initialDashboard.contacts);
  const [tasks, setTasks] = useState<Task[]>(initialDashboard.tasks);
  const [customFieldDefinitions, setCustomFieldDefinitions] = useState<CustomFieldDefinition[]>(
    initialDashboard.customFieldDefinitions
  );
  const [customFieldDraft, setCustomFieldDraft] = useState<CustomFieldDraft>({
    entityType: "account",
    label: "",
    key: "",
    fieldType: "text",
    required: false,
    isIndexed: false,
    options: ""
  });
  const [customFieldValueDrafts, setCustomFieldValueDrafts] = useState<CustomFieldValueDrafts>({});
  const [savingCustomFieldRecordId, setSavingCustomFieldRecordId] = useState<string | null>(null);
  const [customFieldMessage, setCustomFieldMessage] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);
  const [leadMessage, setLeadMessage] = useState("");
  const [contactCsv, setContactCsv] = useState("");
  const [importPreview, setImportPreview] = useState<ContactImportPreview | null>(null);
  const [dataMessage, setDataMessage] = useState("");
  const [dataBusy, setDataBusy] = useState(false);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [sessionError, setSessionError] = useState("");
  const sessionPromiseRef = useRef<Promise<SessionResponse | null> | null>(null);

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );

  const contactsById = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, contact])),
    [contacts]
  );

  const customFieldsByEntity = useMemo(() => {
    const grouped = new Map<RecordEntityType, CustomFieldDefinition[]>();
    for (const definition of customFieldDefinitions) {
      const definitions = grouped.get(definition.entityType) ?? [];
      definitions.push(definition);
      grouped.set(definition.entityType, definitions);
    }
    return grouped;
  }, [customFieldDefinitions]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOpportunities = useMemo(
    () =>
      opportunities.filter((opportunity) => {
        const account = accountsById.get(opportunity.accountId);
        const matchesStage = stageFilter === "all" || opportunity.stage === stageFilter;
        const searchable = `${opportunity.name} ${opportunity.stage} ${account?.name ?? ""} ${searchableCustomFields(
          opportunity.customFields,
          customFieldsByEntity.get("opportunity") ?? []
        )}`;
        return matchesStage && searchable.toLowerCase().includes(normalizedQuery);
      }),
    [accountsById, customFieldsByEntity, normalizedQuery, opportunities, stageFilter]
  );

  const filteredAccounts = useMemo(
    () =>
      accounts.filter((account) =>
        `${account.name} ${account.domain ?? ""} ${account.status} ${searchableCustomFields(
          account.customFields,
          customFieldsByEntity.get("account") ?? []
        )}`
          .toLowerCase()
          .includes(normalizedQuery)
      ),
    [accounts, customFieldsByEntity, normalizedQuery]
  );

  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) =>
        `${lead.contactName} ${lead.companyName ?? ""} ${lead.email ?? ""} ${lead.status} ${searchableCustomFields(
          lead.customFields,
          customFieldsByEntity.get("lead") ?? []
        )}`
          .toLowerCase()
          .includes(normalizedQuery)
      ),
    [customFieldsByEntity, leads, normalizedQuery]
  );

  const filteredContacts = useMemo(
    () =>
      contacts.filter((contact) =>
        `${contact.firstName} ${contact.lastName} ${contact.email ?? ""} ${searchableCustomFields(
          contact.customFields,
          customFieldsByEntity.get("contact") ?? []
        )}`
          .toLowerCase()
          .includes(normalizedQuery)
      ),
    [contacts, customFieldsByEntity, normalizedQuery]
  );

  const pipelineValue = opportunities.reduce(
    (sum, opportunity) =>
      opportunity.stage === "closed_lost"
        ? sum
        : sum + (opportunity.amount ?? 0) * ((opportunity.probabilityPct ?? 0) / 100),
    0
  );
  const openTasks = tasks.filter((task) => task.status !== "done" && task.status !== "cancelled");
  const activeAccounts = accounts.filter(
    (account) => account.status !== "inactive"
  );
  const openLeads = leads.filter((lead) => lead.status !== "converted" && lead.status !== "disqualified");
  const sessionDisplayName = !apiBaseUrl
    ? "Local demo"
    : session?.user.displayName ?? (sessionError ? "Unavailable" : "Connecting");
  const sessionStateLabel = !apiBaseUrl ? "Seed data" : sessionError ? "Offline" : "Signed in";

  const ensureSession = useCallback(async (): Promise<SessionResponse | null> => {
    if (!apiBaseUrl) {
      return null;
    }

    if (
      session?.csrfToken &&
      (process.env.NODE_ENV === "production" || session.user.id === seedManagerId)
    ) {
      return session;
    }

    if (!sessionPromiseRef.current) {
      const client = new CRMClient({ baseUrl: apiBaseUrl });
      sessionPromiseRef.current = (async () => {
        const existingSession = await client.session().catch(() => null);
        if (
          existingSession?.csrfToken &&
          (process.env.NODE_ENV === "production" || existingSession.user.id === seedManagerId)
        ) {
          return existingSession;
        }

        try {
          return await client.devLogin({ tenantId: seedTenantId, userId: seedManagerId });
        } catch (error) {
          if (existingSession?.csrfToken) {
            return existingSession;
          }
          throw error;
        }
      })()
        .then((nextSession) => {
          setSession(nextSession);
          setSessionError("");
          return nextSession;
        })
        .catch((error) => {
          setSession(null);
          setSessionError(errorSummary(error));
          return null;
        })
        .finally(() => {
          sessionPromiseRef.current = null;
        });
    }

    return sessionPromiseRef.current;
  }, [apiBaseUrl, session]);

  const authenticatedClient = useCallback(async (): Promise<CRMClient | null> => {
    if (!apiBaseUrl) {
      return null;
    }

    const activeSession = await ensureSession();
    if (!activeSession?.csrfToken) {
      throw new Error("Session is not ready");
    }

    return new CRMClient({
      baseUrl: apiBaseUrl,
      csrfToken: activeSession.csrfToken
    });
  }, [apiBaseUrl, ensureSession]);

  useEffect(() => {
    void ensureSession();
  }, [ensureSession]);

  async function advanceOpportunity(opportunity: Opportunity) {
    const currentIndex = opportunityStageOrder.indexOf(opportunity.stage);
    const nextStage = opportunityStageOrder[currentIndex + 1];

    if (!nextStage || opportunity.stage === "closed_won" || opportunity.stage === "closed_lost") {
      return;
    }

    const optimistic: Opportunity = {
      ...opportunity,
      stage: nextStage,
      version: opportunity.version + 1,
      updatedAt: new Date().toISOString()
    };

    setOpportunities((current) =>
      current.map((candidate) => (candidate.id === opportunity.id ? optimistic : candidate))
    );
    setSyncingId(opportunity.id);

    if (apiBaseUrl) {
      try {
        const client = await authenticatedClient();
        if (!client) {
          return;
        }
        const saved = await client.updateOpportunity(opportunity.id, {
          expectedVersion: opportunity.version,
          stage: nextStage
        });
        setOpportunities((current) =>
          current.map((candidate) => (candidate.id === saved.id ? saved : candidate))
        );
      } catch {
        setOpportunities((current) =>
          current.map((candidate) => (candidate.id === opportunity.id ? opportunity : candidate))
        );
      }
    }

    setSyncingId(null);
  }

  async function completeTask(task: Task) {
    const optimistic: Task = {
      ...task,
      status: "done",
      version: task.version + 1,
      updatedAt: new Date().toISOString()
    };

    setTasks((current) =>
      current.map((candidate) => (candidate.id === task.id ? optimistic : candidate))
    );

    if (apiBaseUrl) {
      try {
        const client = await authenticatedClient();
        if (!client) {
          return;
        }
        const saved = await client.completeTask(task.id, { expectedVersion: task.version });
        setTasks((current) =>
          current.map((candidate) => (candidate.id === saved.id ? saved : candidate))
        );
      } catch {
        setTasks((current) =>
          current.map((candidate) => (candidate.id === task.id ? task : candidate))
        );
      }
    }
  }

  async function convertLeadToOpportunity(lead: Lead) {
    if (!apiBaseUrl || lead.status === "converted" || lead.status === "disqualified") {
      return;
    }

    setConvertingLeadId(lead.id);
    setLeadMessage("");

    try {
      const activeSession = await ensureSession();
      const client = await authenticatedClient();
      if (!client || !activeSession) {
        return;
      }

      const companyName = lead.companyName ?? lead.contactName;
      const result = await client.convertLead(lead.id, {
        expectedVersion: lead.version,
        accountName: companyName,
        opportunity: {
          name: `${companyName} opportunity`,
          stage: "qualification",
          currency: "USD",
          ownerUserId: activeSession.user.id,
          probabilityPct: 20,
          customFields: {}
        }
      });

      setLeads((current) =>
        current.map((candidate) => (candidate.id === result.lead.id ? result.lead : candidate))
      );
      setAccounts((current) =>
        current.some((account) => account.id === result.account.id)
          ? current
          : [result.account, ...current]
      );
      setContacts((current) =>
        current.some((contact) => contact.id === result.contact.id)
          ? current
          : [result.contact, ...current]
      );
      if (result.opportunity) {
        setOpportunities((current) =>
          current.some((opportunity) => opportunity.id === result.opportunity!.id)
            ? current
            : [result.opportunity!, ...current]
        );
      }
      setLeadMessage(`Converted ${lead.contactName}`);
    } catch (error) {
      setLeadMessage(errorSummary(error));
    } finally {
      setConvertingLeadId(null);
    }
  }

  async function exportRecords(entity: ExportEntity) {
    if (!apiBaseUrl) {
      setDataMessage("API is not configured");
      return;
    }

    setDataBusy(true);
    setDataMessage("");
    try {
      const client = await authenticatedClient();
      if (!client) {
        return;
      }
      const csv = await client.exportRecords(entity);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `clientloop-${entity}.csv`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      setDataMessage(`Exported ${entity}`);
    } catch (error) {
      setDataMessage(errorSummary(error));
    } finally {
      setDataBusy(false);
    }
  }

  async function previewContactCsv() {
    if (!apiBaseUrl) {
      setDataMessage("API is not configured");
      return;
    }

    setDataBusy(true);
    setDataMessage("");
    try {
      const client = await authenticatedClient();
      if (!client) {
        return;
      }
      const preview = await client.previewContactImport({ csv: contactCsv });
      setImportPreview(preview);
      setDataMessage(`${preview.validRows} valid rows from ${preview.totalRows}`);
    } catch (error) {
      setDataMessage(errorSummary(error));
    } finally {
      setDataBusy(false);
    }
  }

  async function importContactCsv() {
    if (!apiBaseUrl) {
      setDataMessage("API is not configured");
      return;
    }

    setDataBusy(true);
    setDataMessage("");
    try {
      const client = await authenticatedClient();
      if (!client) {
        return;
      }
      const result = await client.importContacts({ csv: contactCsv });
      setContacts((current) => [...result.contacts, ...current]);
      setImportPreview(null);
      setContactCsv("");
      setDataMessage(`Imported ${result.importedCount} contacts`);
    } catch (error) {
      setDataMessage(errorSummary(error));
    } finally {
      setDataBusy(false);
    }
  }

  async function createCustomFieldDefinition() {
    if (!apiBaseUrl) {
      setDataMessage("API is not configured");
      return;
    }

    const input = customFieldDefinitionInput(customFieldDraft);
    if (!input) {
      setDataMessage("Custom field label is required");
      return;
    }

    setDataBusy(true);
    setDataMessage("");
    try {
      const client = await authenticatedClient();
      if (!client) {
        return;
      }
      const definition = await client.createCustomFieldDefinition(input);
      setCustomFieldDefinitions((current) => [...current, definition]);
      setCustomFieldDraft({
        entityType: customFieldDraft.entityType,
        label: "",
        key: "",
        fieldType: "text",
        required: false,
        isIndexed: false,
        options: ""
      });
      setDataMessage(`Created ${definition.label}`);
    } catch (error) {
      setDataMessage(errorSummary(error));
    } finally {
      setDataBusy(false);
    }
  }

  function updateCustomFieldDraftValue(
    entityType: RecordEntityType,
    recordId: string,
    fieldKey: string,
    value: string
  ) {
    const draftKey = recordDraftKey(entityType, recordId);
    setCustomFieldValueDrafts((current) => ({
      ...current,
      [draftKey]: {
        ...(current[draftKey] ?? {}),
        [fieldKey]: value
      }
    }));
  }

  async function saveRecordCustomFields(
    entityType: RecordEntityType,
    record: CustomFieldRecord,
    definitions: CustomFieldDefinition[]
  ) {
    if (!apiBaseUrl) {
      setCustomFieldMessage("API is not configured");
      return;
    }

    const draftKey = recordDraftKey(entityType, record.id);
    const draft = customFieldValueDrafts[draftKey];
    if (!draft || Object.keys(draft).length === 0) {
      return;
    }

    setSavingCustomFieldRecordId(draftKey);
    setCustomFieldMessage("");
    try {
      const client = await authenticatedClient();
      if (!client) {
        return;
      }
      const customFields = customFieldPatchFromDraft(draft, definitions);
      const updated = await client.updateCustomFieldValues(entityType, record.id, {
        expectedVersion: record.version,
        customFields
      });
      replaceUpdatedRecord(entityType, updated);
      setCustomFieldValueDrafts((current) => {
        const { [draftKey]: _saved, ...rest } = current;
        return rest;
      });
      setCustomFieldMessage(`Updated ${recordLabel(updated)}`);
    } catch (error) {
      setCustomFieldMessage(errorSummary(error));
    } finally {
      setSavingCustomFieldRecordId(null);
    }
  }

  function replaceUpdatedRecord(entityType: RecordEntityType, record: CustomFieldRecord) {
    switch (entityType) {
      case "account":
        setAccounts((current) =>
          current.map((candidate) =>
            candidate.id === record.id ? (record as Account) : candidate
          )
        );
        break;
      case "contact":
        setContacts((current) =>
          current.map((candidate) =>
            candidate.id === record.id ? (record as Contact) : candidate
          )
        );
        break;
      case "lead":
        setLeads((current) =>
          current.map((candidate) => (candidate.id === record.id ? (record as Lead) : candidate))
        );
        break;
      case "opportunity":
        setOpportunities((current) =>
          current.map((candidate) =>
            candidate.id === record.id ? (record as Opportunity) : candidate
          )
        );
        break;
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Workspace navigation">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            CL
          </div>
          <div>
            <p className="eyebrow">ClientLoop</p>
            <h1>CRM</h1>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary">
          <button
            className={viewMode === "pipeline" ? "active" : ""}
            onClick={() => setViewMode("pipeline")}
          >
            <CircleDollarSign size={18} /> Pipeline
          </button>
          <button
            className={viewMode === "leads" ? "active" : ""}
            onClick={() => setViewMode("leads")}
          >
            <UserPlus size={18} /> Leads
          </button>
          <button
            className={viewMode === "accounts" ? "active" : ""}
            onClick={() => setViewMode("accounts")}
          >
            <Building2 size={18} /> Accounts
          </button>
          <button
            className={viewMode === "contacts" ? "active" : ""}
            onClick={() => setViewMode("contacts")}
          >
            <UserRound size={18} /> Contacts
          </button>
          <button
            className={viewMode === "data" ? "active" : ""}
            onClick={() => setViewMode("data")}
          >
            <Database size={18} /> Data
          </button>
        </nav>

        <div className="session-card" aria-label="Current user">
          <span>
            <UserRound size={18} />
          </span>
          <div>
            <p className="eyebrow">{sessionStateLabel}</p>
            <strong>{sessionDisplayName}</strong>
          </div>
        </div>

        <div className="sidebar-metrics">
          <Metric icon={<CircleDollarSign size={18} />} label="Weighted" value={formatCurrency(pipelineValue)} />
          <Metric icon={<UserPlus size={18} />} label="Open leads" value={String(openLeads.length)} />
          <Metric icon={<Building2 size={18} />} label="Accounts" value={String(activeAccounts.length)} />
          <Metric icon={<ClipboardCheck size={18} />} label="Open tasks" value={String(openTasks.length)} />
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Sales workspace</p>
            <h2>{viewModeTitle(viewMode)}</h2>
          </div>
          <div className="toolbar">
            <label className="search-field">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Search records</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search records"
              />
            </label>
            <button className="icon-button" title="Refresh" aria-label="Refresh">
              <RefreshCcw size={18} />
            </button>
            <button className="command-button">
              <Plus size={18} /> New
            </button>
          </div>
        </header>

        <div className="content-grid">
          <section className="main-panel" aria-label={viewModeTitle(viewMode)}>
            {viewMode === "pipeline" ? (
              <PipelineView
                accountsById={accountsById}
                customFieldDefinitions={customFieldsByEntity.get("opportunity") ?? []}
                customFieldMessage={customFieldMessage}
                customFieldValueDrafts={customFieldValueDrafts}
                filteredOpportunities={filteredOpportunities}
                savingCustomFieldRecordId={savingCustomFieldRecordId}
                stageFilter={stageFilter}
                syncingId={syncingId}
                onAdvance={advanceOpportunity}
                onCustomFieldDraftChange={updateCustomFieldDraftValue}
                onSaveCustomFields={saveRecordCustomFields}
                onStageFilter={setStageFilter}
              />
            ) : null}

            {viewMode === "leads" ? (
              <LeadsView
                convertingLeadId={convertingLeadId}
                leads={filteredLeads}
                message={leadMessage}
                onConvert={convertLeadToOpportunity}
              />
            ) : null}

            {viewMode === "accounts" ? (
              <AccountsView
                accounts={filteredAccounts}
                customFieldDefinitions={customFieldsByEntity.get("account") ?? []}
                customFieldMessage={customFieldMessage}
                customFieldValueDrafts={customFieldValueDrafts}
                opportunities={opportunities}
                savingCustomFieldRecordId={savingCustomFieldRecordId}
                onCustomFieldDraftChange={updateCustomFieldDraftValue}
                onSaveCustomFields={saveRecordCustomFields}
              />
            ) : null}

            {viewMode === "contacts" ? (
              <ContactsView contacts={filteredContacts} accountsById={accountsById} />
            ) : null}

            {viewMode === "data" ? (
              <DataView
                contactCsv={contactCsv}
                customFieldDefinitions={customFieldDefinitions}
                customFieldDraft={customFieldDraft}
                dataBusy={dataBusy}
                dataMessage={dataMessage}
                importPreview={importPreview}
                onContactCsvChange={setContactCsv}
                onCreateCustomField={createCustomFieldDefinition}
                onCustomFieldDraftChange={setCustomFieldDraft}
                onExport={exportRecords}
                onImport={importContactCsv}
                onPreview={previewContactCsv}
              />
            ) : null}
          </section>

          <aside className="side-panel" aria-label="Work queue">
            <TaskQueue
              tasks={tasks}
              accountsById={accountsById}
              opportunities={opportunities}
              onComplete={completeTask}
            />
            <Timeline
              activities={initialDashboard.activities}
              opportunities={opportunities}
              accountsById={accountsById}
              contactsById={contactsById}
            />
          </aside>
        </div>
      </section>
    </main>
  );
}

function LeadsView({
  convertingLeadId,
  leads,
  message,
  onConvert
}: {
  convertingLeadId: string | null;
  leads: Lead[];
  message: string;
  onConvert: (lead: Lead) => void;
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
                    <strong>{lead.contactName}</strong>
                    <p className="table-subtext">{lead.email ?? ""}</p>
                  </td>
                  <td>{lead.companyName ?? ""}</td>
                  <td>{lead.source}</td>
                  <td>
                    <StatusPill value={lead.status} />
                  </td>
                  <td>
                    <button
                      className="table-action"
                      disabled={!canConvert || convertingLeadId === lead.id}
                      onClick={() => onConvert(lead)}
                    >
                      <ArrowRight size={16} /> Convert
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

function PipelineView(props: {
  accountsById: Map<string, Account>;
  customFieldDefinitions: CustomFieldDefinition[];
  customFieldMessage: string;
  customFieldValueDrafts: CustomFieldValueDrafts;
  filteredOpportunities: Opportunity[];
  savingCustomFieldRecordId: string | null;
  stageFilter: OpportunityStage | "all";
  syncingId: string | null;
  onAdvance: (opportunity: Opportunity) => void;
  onCustomFieldDraftChange: (
    entityType: RecordEntityType,
    recordId: string,
    fieldKey: string,
    value: string
  ) => void;
  onSaveCustomFields: (
    entityType: RecordEntityType,
    record: CustomFieldRecord,
    definitions: CustomFieldDefinition[]
  ) => void;
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
                    <CustomFieldValueEditor
                      definitions={props.customFieldDefinitions}
                      drafts={props.customFieldValueDrafts}
                      entityType="opportunity"
                      record={opportunity}
                      savingRecordId={props.savingCustomFieldRecordId}
                      onDraftChange={props.onCustomFieldDraftChange}
                      onSave={props.onSaveCustomFields}
                    />
                    <div className="card-row">
                      <span>{formatDate(opportunity.expectedCloseDate)}</span>
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
      {props.customFieldMessage ? <p className="data-message">{props.customFieldMessage}</p> : null}
    </>
  );
}

function AccountsView({
  accounts,
  customFieldDefinitions,
  customFieldMessage,
  customFieldValueDrafts,
  opportunities,
  savingCustomFieldRecordId,
  onCustomFieldDraftChange,
  onSaveCustomFields
}: {
  accounts: Account[];
  customFieldDefinitions: CustomFieldDefinition[];
  customFieldMessage: string;
  customFieldValueDrafts: CustomFieldValueDrafts;
  opportunities: Opportunity[];
  savingCustomFieldRecordId: string | null;
  onCustomFieldDraftChange: (
    entityType: RecordEntityType,
    recordId: string,
    fieldKey: string,
    value: string
  ) => void;
  onSaveCustomFields: (
    entityType: RecordEntityType,
    record: CustomFieldRecord,
    definitions: CustomFieldDefinition[]
  ) => void;
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
              <th scope="col">Fields</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const pipeline = opportunities
                .filter((opportunity) => opportunity.accountId === account.id)
                .reduce((sum, opportunity) => sum + (opportunity.amount ?? 0), 0);
              const draftKey = recordDraftKey("account", account.id);
              const hasDraft = hasCustomFieldDraft(customFieldValueDrafts, draftKey);
              return (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td>
                    <StatusPill value={account.status} />
                  </td>
                  <td>{account.domain ?? ""}</td>
                  <td>{formatCurrency(pipeline)}</td>
                  {customFieldDefinitions.map((definition) => (
                    <td key={definition.id}>
                      <CustomFieldInput
                        definition={definition}
                        value={draftCustomFieldValue(
                          customFieldValueDrafts,
                          account,
                          definition,
                          "account"
                        )}
                        onChange={(value) =>
                          onCustomFieldDraftChange("account", account.id, definition.key, value)
                        }
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      className="table-action"
                      disabled={!hasDraft || savingCustomFieldRecordId === draftKey}
                      onClick={() => onSaveCustomFields("account", account, customFieldDefinitions)}
                    >
                      <Check size={16} /> Save
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {customFieldMessage ? <p className="data-message">{customFieldMessage}</p> : null}
    </>
  );
}

function ContactsView({
  contacts,
  accountsById
}: {
  contacts: Contact[];
  accountsById: Map<string, Account>;
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
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id}>
                <td>{contact.firstName} {contact.lastName}</td>
                <td>{contact.email ?? ""}</td>
                <td>{contact.phone ?? ""}</td>
                <td>{contact.accountId ? accountsById.get(contact.accountId)?.name ?? "" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DataView({
  contactCsv,
  customFieldDefinitions,
  customFieldDraft,
  dataBusy,
  dataMessage,
  importPreview,
  onContactCsvChange,
  onCreateCustomField,
  onCustomFieldDraftChange,
  onExport,
  onImport,
  onPreview
}: {
  contactCsv: string;
  customFieldDefinitions: CustomFieldDefinition[];
  customFieldDraft: CustomFieldDraft;
  dataBusy: boolean;
  dataMessage: string;
  importPreview: ContactImportPreview | null;
  onContactCsvChange: (value: string) => void;
  onCreateCustomField: () => void;
  onCustomFieldDraftChange: (value: CustomFieldDraft) => void;
  onExport: (entity: ExportEntity) => void;
  onImport: () => void;
  onPreview: () => void;
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
            <button disabled={dataBusy} onClick={() => onExport("accounts")}>
              <Download size={16} /> Accounts
            </button>
            <button disabled={dataBusy} onClick={() => onExport("contacts")}>
              <Download size={16} /> Contacts
            </button>
            <button disabled={dataBusy} onClick={() => onExport("opportunities")}>
              <Download size={16} /> Opportunities
            </button>
          </div>
        </section>

        <section className="data-section" aria-label="Contact import">
          <div>
            <p className="eyebrow">Import</p>
            <h4>Contact CSV</h4>
          </div>
          <label className="csv-editor">
            <span className="sr-only">Contact CSV</span>
            <textarea
              value={contactCsv}
              onChange={(event) => onContactCsvChange(event.target.value)}
              placeholder={contactCsvPlaceholder}
              spellCheck={false}
            />
          </label>
          <div className="data-actions">
            <button disabled={dataBusy || contactCsv.trim().length === 0} onClick={onPreview}>
              <Search size={16} /> Preview
            </button>
            <button
              className="primary-action"
              disabled={dataBusy || !importPreview || importPreview.errors.length > 0}
              onClick={onImport}
            >
              <Upload size={16} /> Import
            </button>
          </div>

          {importPreview ? (
            <div className="import-summary" aria-label="Import preview">
              <strong>{importPreview.validRows}</strong>
              <span>valid</span>
              <strong>{importPreview.errors.length}</strong>
              <span>errors</span>
              <strong>{importPreview.totalRows}</strong>
              <span>rows</span>
            </div>
          ) : null}

          {importPreview?.errors.length ? (
            <ul className="import-errors">
              {importPreview.errors.slice(0, 4).map((error) => (
                <li key={`${error.row}-${error.field}-${error.message}`}>
                  Row {error.row}: {error.field} - {error.message}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

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
              disabled={dataBusy || customFieldDraft.label.trim().length === 0}
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

function TaskQueue({
  tasks,
  opportunities,
  accountsById,
  onComplete
}: {
  tasks: Task[];
  opportunities: Opportunity[];
  accountsById: Map<string, Account>;
  onComplete: (task: Task) => void;
}) {
  const opportunityById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));

  return (
    <section className="queue-panel" aria-label="Tasks">
      <div className="panel-heading small">
        <div>
          <p className="eyebrow">Tasks</p>
          <h3>Today and next</h3>
        </div>
        <ClipboardCheck size={18} aria-hidden="true" />
      </div>
      <div className="task-list">
        {tasks.map((task) => {
          const parentOpportunity =
            task.parent?.type === "opportunity" ? opportunityById.get(task.parent.id) : undefined;
          const parentAccount =
            task.parent?.type === "account"
              ? accountsById.get(task.parent.id)
              : parentOpportunity
                ? accountsById.get(parentOpportunity.accountId)
                : undefined;

          return (
            <article className={`task-item ${task.status === "done" ? "done" : ""}`} key={task.id}>
              <div>
                <h4>{task.title}</h4>
                <p>{parentAccount?.name ?? "Unlinked"}</p>
                <span>{formatDate(task.dueAt)}</span>
              </div>
              <button
                className="icon-button compact"
                title="Complete task"
                aria-label={`Complete ${task.title}`}
                disabled={task.status === "done"}
                onClick={() => onComplete(task)}
              >
                <Check size={16} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Timeline({
  activities,
  opportunities,
  accountsById,
  contactsById
}: {
  activities: DashboardResponse["activities"];
  opportunities: Opportunity[];
  accountsById: Map<string, Account>;
  contactsById: Map<string, Contact>;
}) {
  const opportunityById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));

  function parentLabel(activity: DashboardResponse["activities"][number]) {
    if (activity.parent.type === "opportunity") {
      return opportunityById.get(activity.parent.id)?.name ?? "Opportunity";
    }

    if (activity.parent.type === "account") {
      return accountsById.get(activity.parent.id)?.name ?? "Account";
    }

    if (activity.parent.type === "contact") {
      const contact = contactsById.get(activity.parent.id);
      return contact ? `${contact.firstName} ${contact.lastName}` : "Contact";
    }

    return activity.parent.type;
  }

  return (
    <section className="queue-panel" aria-label="Activity timeline">
      <div className="panel-heading small">
        <div>
          <p className="eyebrow">Timeline</p>
          <h3>Recent activity</h3>
        </div>
        <Activity size={18} aria-hidden="true" />
      </div>
      <div className="timeline-list">
        {activities.map((activity) => (
          <article className="timeline-item" key={activity.id}>
            <div className="timeline-dot" aria-hidden="true" />
            <div>
              <h4>{activity.subject}</h4>
              <p>{parentLabel(activity)}</p>
              <span>{formatDate(activity.occurredAt)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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

function StatusPill({ value }: { value: string }) {
  return <span className={`status-pill ${value}`}>{value.replace("_", " ")}</span>;
}

function CustomFieldBadges({
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

function CustomFieldValueEditor({
  definitions,
  drafts,
  entityType,
  record,
  savingRecordId,
  onDraftChange,
  onSave
}: {
  definitions: CustomFieldDefinition[];
  drafts: CustomFieldValueDrafts;
  entityType: RecordEntityType;
  record: CustomFieldRecord;
  savingRecordId: string | null;
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
            value={draftCustomFieldValue(drafts, record, definition, entityType)}
            onChange={(value) => onDraftChange(entityType, record.id, definition.key, value)}
          />
        </label>
      ))}
      <button
        className="table-action"
        disabled={!hasDraft || savingRecordId === draftKey}
        onClick={() => onSave(entityType, record, definitions)}
      >
        <Check size={16} /> Save fields
      </button>
    </div>
  );
}

function CustomFieldInput({
  definition,
  value,
  onChange
}: {
  definition: CustomFieldDefinition;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = customFieldOptions(definition);

  if (definition.fieldType === "boolean") {
    return (
      <select className="field-input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Unset</option>
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    );
  }

  if (definition.fieldType === "single_select" && options.length > 0) {
    return (
      <select className="field-input" value={value} onChange={(event) => onChange(event.target.value)}>
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
      type={definition.fieldType === "number" ? "number" : definition.fieldType === "date" ? "date" : "text"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={definition.fieldType === "multi_select" ? "value, value" : undefined}
    />
  );
}

function viewModeTitle(viewMode: ViewMode) {
  switch (viewMode) {
    case "pipeline":
      return "Pipeline";
    case "leads":
      return "Leads";
    case "accounts":
      return "Accounts";
    case "contacts":
      return "Contacts";
    case "data":
      return "Data";
  }
}

function customFieldDefinitionInput(
  draft: CustomFieldDraft
): CreateCustomFieldDefinitionInput | null {
  const label = draft.label.trim();
  if (!label) {
    return null;
  }

  return {
    entityType: draft.entityType,
    key: draft.key.trim() || undefined,
    label,
    fieldType: draft.fieldType,
    required: draft.required,
    isIndexed: draft.isIndexed,
    schema: isSelectField(draft.fieldType)
      ? {
          options: draft.options
            .split(",")
            .map((option) => option.trim())
            .filter(Boolean)
        }
      : {}
  };
}

function isSelectField(fieldType: CustomFieldType) {
  return fieldType === "single_select" || fieldType === "multi_select";
}

function recordDraftKey(entityType: RecordEntityType, recordId: string) {
  return `${entityType}:${recordId}`;
}

function hasCustomFieldDraft(drafts: CustomFieldValueDrafts, draftKey: string) {
  return Object.keys(drafts[draftKey] ?? {}).length > 0;
}

function draftCustomFieldValue(
  drafts: CustomFieldValueDrafts,
  record: CustomFieldRecord,
  definition: CustomFieldDefinition,
  entityType: RecordEntityType
) {
  return (
    drafts[recordDraftKey(entityType, record.id)]?.[definition.key] ??
    formatCustomFieldValue(record.customFields[definition.key])
  );
}

function customFieldPatchFromDraft(
  draft: Record<string, string>,
  definitions: CustomFieldDefinition[]
) {
  const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const customFields: Record<string, CustomFieldPrimitive> = {};

  for (const [key, value] of Object.entries(draft)) {
    const definition = definitionByKey.get(key);
    if (!definition) {
      continue;
    }
    customFields[key] = parseCustomFieldValue(definition, value);
  }

  return customFields;
}

function parseCustomFieldValue(
  definition: CustomFieldDefinition,
  value: string
): CustomFieldPrimitive {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  switch (definition.fieldType) {
    case "number":
      return Number(trimmed);
    case "boolean":
      return trimmed === "true";
    case "multi_select":
      return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
    case "currency":
      return { amount: Number(trimmed), currency: "USD" };
    case "user_ref":
    case "account_ref":
      return { id: trimmed, label: trimmed };
    default:
      return trimmed;
  }
}

function customFieldOptions(definition: CustomFieldDefinition) {
  const options = definition.schema?.options;
  return Array.isArray(options) && options.every((option) => typeof option === "string")
    ? options
    : [];
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function searchableCustomFields(
  values: Record<string, CustomFieldPrimitive>,
  definitions: CustomFieldDefinition[]
) {
  return definitions
    .map((definition) => `${definition.label} ${formatCustomFieldValue(values[definition.key])}`)
    .join(" ");
}

function formatCustomFieldValue(value: CustomFieldPrimitive | undefined): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    if ("amount" in value && "currency" in value) {
      return `${value.currency} ${value.amount}`;
    }

    return value.label;
  }

  return String(value);
}

function recordLabel(record: CustomFieldRecord) {
  if ("name" in record) {
    return record.name;
  }

  if ("contactName" in record) {
    return record.contactName;
  }

  return `${record.firstName} ${record.lastName}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function errorSummary(error: unknown) {
  if (error instanceof CRMClientError) {
    return `Request failed (${error.status})`;
  }

  return error instanceof Error ? error.message : "Action failed";
}
