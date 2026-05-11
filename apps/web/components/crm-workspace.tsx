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
  UserRound
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  ContactImportPreview,
  DashboardResponse,
  ExportEntity
} from "@clientloop/contracts";
import type {
  Account,
  Contact,
  Opportunity,
  OpportunityStage,
  Task
} from "@clientloop/domain";
import { opportunityStageOrder, seedManagerId, seedTenantId, seedUserId } from "@clientloop/domain";
import { CRMClient, CRMClientError } from "@clientloop/ui-sdk";

type ViewMode = "pipeline" | "accounts" | "contacts" | "data";

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
  const [viewMode, setViewMode] = useState<ViewMode>("pipeline");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<OpportunityStage | "all">("all");
  const [opportunities, setOpportunities] = useState<Opportunity[]>(
    initialDashboard.opportunities
  );
  const [contacts, setContacts] = useState<Contact[]>(initialDashboard.contacts);
  const [tasks, setTasks] = useState<Task[]>(initialDashboard.tasks);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [contactCsv, setContactCsv] = useState("");
  const [importPreview, setImportPreview] = useState<ContactImportPreview | null>(null);
  const [dataMessage, setDataMessage] = useState("");
  const [dataBusy, setDataBusy] = useState(false);

  const accountsById = useMemo(
    () => new Map(initialDashboard.accounts.map((account) => [account.id, account])),
    [initialDashboard.accounts]
  );

  const contactsById = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, contact])),
    [contacts]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOpportunities = useMemo(
    () =>
      opportunities.filter((opportunity) => {
        const account = accountsById.get(opportunity.accountId);
        const matchesStage = stageFilter === "all" || opportunity.stage === stageFilter;
        const searchable = `${opportunity.name} ${opportunity.stage} ${account?.name ?? ""}`;
        return matchesStage && searchable.toLowerCase().includes(normalizedQuery);
      }),
    [accountsById, normalizedQuery, opportunities, stageFilter]
  );

  const filteredAccounts = useMemo(
    () =>
      initialDashboard.accounts.filter((account) =>
        `${account.name} ${account.domain ?? ""} ${account.status}`
          .toLowerCase()
          .includes(normalizedQuery)
      ),
    [initialDashboard.accounts, normalizedQuery]
  );

  const filteredContacts = useMemo(
    () =>
      contacts.filter((contact) =>
        `${contact.firstName} ${contact.lastName} ${contact.email ?? ""}`
          .toLowerCase()
          .includes(normalizedQuery)
      ),
    [contacts, normalizedQuery]
  );

  const pipelineValue = opportunities.reduce(
    (sum, opportunity) =>
      opportunity.stage === "closed_lost"
        ? sum
        : sum + (opportunity.amount ?? 0) * ((opportunity.probabilityPct ?? 0) / 100),
    0
  );
  const openTasks = tasks.filter((task) => task.status !== "done" && task.status !== "cancelled");
  const activeAccounts = initialDashboard.accounts.filter(
    (account) => account.status !== "inactive"
  );

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

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (apiBaseUrl) {
      try {
        const client = new CRMClient({
          baseUrl: apiBaseUrl,
          tenantId: seedTenantId,
          userId: seedUserId
        });
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

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (apiBaseUrl) {
      try {
        const client = new CRMClient({
          baseUrl: apiBaseUrl,
          tenantId: seedTenantId,
          userId: seedUserId
        });
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

  async function exportRecords(entity: ExportEntity) {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBaseUrl) {
      setDataMessage("API is not configured");
      return;
    }

    setDataBusy(true);
    setDataMessage("");
    try {
      const client = new CRMClient({
        baseUrl: apiBaseUrl,
        tenantId: seedTenantId,
        userId: seedManagerId
      });
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
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBaseUrl) {
      setDataMessage("API is not configured");
      return;
    }

    setDataBusy(true);
    setDataMessage("");
    try {
      const client = new CRMClient({
        baseUrl: apiBaseUrl,
        tenantId: seedTenantId,
        userId: seedUserId
      });
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
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBaseUrl) {
      setDataMessage("API is not configured");
      return;
    }

    setDataBusy(true);
    setDataMessage("");
    try {
      const client = new CRMClient({
        baseUrl: apiBaseUrl,
        tenantId: seedTenantId,
        userId: seedUserId
      });
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

        <div className="sidebar-metrics">
          <Metric icon={<CircleDollarSign size={18} />} label="Weighted" value={formatCurrency(pipelineValue)} />
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
                filteredOpportunities={filteredOpportunities}
                stageFilter={stageFilter}
                syncingId={syncingId}
                onAdvance={advanceOpportunity}
                onStageFilter={setStageFilter}
              />
            ) : null}

            {viewMode === "accounts" ? (
              <AccountsView accounts={filteredAccounts} opportunities={opportunities} />
            ) : null}

            {viewMode === "contacts" ? (
              <ContactsView contacts={filteredContacts} accountsById={accountsById} />
            ) : null}

            {viewMode === "data" ? (
              <DataView
                contactCsv={contactCsv}
                dataBusy={dataBusy}
                dataMessage={dataMessage}
                importPreview={importPreview}
                onContactCsvChange={setContactCsv}
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

function PipelineView(props: {
  accountsById: Map<string, Account>;
  filteredOpportunities: Opportunity[];
  stageFilter: OpportunityStage | "all";
  syncingId: string | null;
  onAdvance: (opportunity: Opportunity) => void;
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
    </>
  );
}

function AccountsView({
  accounts,
  opportunities
}: {
  accounts: Account[];
  opportunities: Opportunity[];
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
              <th scope="col">Health</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const pipeline = opportunities
                .filter((opportunity) => opportunity.accountId === account.id)
                .reduce((sum, opportunity) => sum + (opportunity.amount ?? 0), 0);
              return (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td>
                    <StatusPill value={account.status} />
                  </td>
                  <td>{account.domain ?? ""}</td>
                  <td>{formatCurrency(pipeline)}</td>
                  <td>{String(account.customFields.health_score ?? "")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
  dataBusy,
  dataMessage,
  importPreview,
  onContactCsvChange,
  onExport,
  onImport,
  onPreview
}: {
  contactCsv: string;
  dataBusy: boolean;
  dataMessage: string;
  importPreview: ContactImportPreview | null;
  onContactCsvChange: (value: string) => void;
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

function viewModeTitle(viewMode: ViewMode) {
  switch (viewMode) {
    case "pipeline":
      return "Pipeline";
    case "accounts":
      return "Accounts";
    case "contacts":
      return "Contacts";
    case "data":
      return "Data";
  }
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
