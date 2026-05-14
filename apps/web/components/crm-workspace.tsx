"use client";

import {
  Activity,
  ArrowRight,
  Building2,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Copy,
  Database,
  Download,
  Filter,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Upload,
  UserPlus,
  UserRound,
  X
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AppendNoteInput,
  ContactImportPreview,
  CreateActivityInput,
  CreateTaskInput,
  CreateCustomFieldDefinitionInput,
  DashboardResponse,
  ExportEntity,
  SessionResponse,
  UpdateActivityInput,
  UpdateNoteInput,
  UpdateTaskInput
} from "@clientloop/contracts";
import type {
  Account,
  Activity as CRMActivity,
  Contact,
  CustomFieldDefinition,
  CustomFieldPrimitive,
  CustomFieldType,
  Lead,
  Note,
  Opportunity,
  OpportunityStage,
  RecordEntityType,
  Task
} from "@clientloop/domain";
import { opportunityStageOrder, seedManagerId, seedTenantId } from "@clientloop/domain";
import { CRMClient, CRMClientError } from "@clientloop/ui-sdk";
import {
  accountCreateInput,
  contactCreateInput,
  contactCreateValidationMessage,
  emptyAccountCreateDraft,
  emptyContactCreateDraft,
  emptyLeadCreateDraft,
  emptyOpportunityCreateDraft,
  leadCreateInput,
  leadCreateValidationMessage,
  opportunityCreateInput,
  opportunityCreateValidationMessage,
  type AccountCreateDraft,
  type ContactCreateDraft,
  type LeadCreateDraft,
  type OpportunityCreateDraft
} from "../lib/create-record-inputs";
import {
  canCreateForView,
  canExportEntity,
  deriveCreatePermissions,
  deriveDataPermissions,
  deriveTimelinePermissions,
  type CreatePermissions,
  type DataPermissions,
  type TimelinePermissions
} from "../lib/session-permissions";

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
type TimelineFilter = "all" | "activity" | "note" | "task";
type ActivityPayloadDraft = {
  outcome: string;
  durationMinutes: string;
  attendees: string;
  emailDirection: "outbound" | "inbound";
  location: string;
};
type ActivityEditDraft = {
  subject: string;
  payload: ActivityPayloadDraft;
};
type TaskEditDraft = {
  title: string;
  description: string;
  dueAt: string;
  priority: Task["priority"];
};
type TaskStatusFilter = Task["status"] | "all";
type TaskOwnerFilter = "all" | "mine";
type TaskDueFilter = "all" | "overdue" | "today" | "upcoming" | "none";
type TimelineItem = {
  id: string;
  at: string;
  category: Exclude<TimelineFilter, "all">;
  kind: string;
  label: string;
  title: string;
  detail: string;
  activity?: CRMActivity;
  note?: Note;
  task?: Task;
};
type SelectedRecordRef =
  | { entityType: "account"; id: string }
  | { entityType: "contact"; id: string }
  | { entityType: "lead"; id: string }
  | { entityType: "opportunity"; id: string };

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => parseViewMode(searchParams.get("view")) ?? "pipeline"
  );
  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatusFilter>(() =>
    parseTaskStatusFilter(searchParams.get("taskStatus"))
  );
  const [taskOwnerFilter, setTaskOwnerFilter] = useState<TaskOwnerFilter>(() =>
    parseTaskOwnerFilter(searchParams.get("taskOwner"))
  );
  const [taskDueFilter, setTaskDueFilter] = useState<TaskDueFilter>(() =>
    parseTaskDueFilter(searchParams.get("taskDue"))
  );
  const taskFilterRef = useRef({
    taskStatusFilter,
    taskOwnerFilter,
    taskDueFilter
  });
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<OpportunityStage | "all">("all");
  const [accounts, setAccounts] = useState<Account[]>(initialDashboard.accounts);
  const [leads, setLeads] = useState<Lead[]>(initialDashboard.leads);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(
    initialDashboard.opportunities
  );
  const [contacts, setContacts] = useState<Contact[]>(initialDashboard.contacts);
  const [tasks, setTasks] = useState<Task[]>(initialDashboard.tasks);
  const [notes, setNotes] = useState<Note[]>(initialDashboard.notes);
  const [activities, setActivities] = useState<CRMActivity[]>(initialDashboard.activities);
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
  const [accountCreateOpen, setAccountCreateOpen] = useState(false);
  const [accountCreateDraft, setAccountCreateDraft] = useState<AccountCreateDraft>(() =>
    emptyAccountCreateDraft()
  );
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [contactCreateOpen, setContactCreateOpen] = useState(false);
  const [contactCreateDraft, setContactCreateDraft] = useState<ContactCreateDraft>(() =>
    emptyContactCreateDraft()
  );
  const [creatingContact, setCreatingContact] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<SelectedRecordRef | null>(() =>
    parseSelectedRecord(searchParams.get("record"))
  );
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);
  const [leadMessage, setLeadMessage] = useState("");
  const [leadCreateOpen, setLeadCreateOpen] = useState(false);
  const [leadCreateDraft, setLeadCreateDraft] = useState<LeadCreateDraft>(() =>
    emptyLeadCreateDraft()
  );
  const [creatingLead, setCreatingLead] = useState(false);
  const [opportunityCreateOpen, setOpportunityCreateOpen] = useState(false);
  const [opportunityCreateDraft, setOpportunityCreateDraft] = useState<OpportunityCreateDraft>(() =>
    emptyOpportunityCreateDraft()
  );
  const [creatingOpportunity, setCreatingOpportunity] = useState(false);
  const [opportunityMessage, setOpportunityMessage] = useState("");
  const [contactCsv, setContactCsv] = useState("");
  const [importPreview, setImportPreview] = useState<ContactImportPreview | null>(null);
  const [dataMessage, setDataMessage] = useState("");
  const [dataBusy, setDataBusy] = useState(false);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [toolbarMessage, setToolbarMessage] = useState("");
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);
  const sessionPromiseRef = useRef<Promise<SessionResponse | null> | null>(null);

  useEffect(() => {
    const nextView = parseViewMode(searchParams.get("view")) ?? "pipeline";
    const nextRecord = parseSelectedRecord(searchParams.get("record"));
    const nextTaskStatusFilter = parseTaskStatusFilter(searchParams.get("taskStatus"));
    const nextTaskOwnerFilter = parseTaskOwnerFilter(searchParams.get("taskOwner"));
    const nextTaskDueFilter = parseTaskDueFilter(searchParams.get("taskDue"));
    setViewMode(nextView);
    setTaskStatusFilter(nextTaskStatusFilter);
    setTaskOwnerFilter(nextTaskOwnerFilter);
    setTaskDueFilter(nextTaskDueFilter);
    taskFilterRef.current = {
      taskStatusFilter: nextTaskStatusFilter,
      taskOwnerFilter: nextTaskOwnerFilter,
      taskDueFilter: nextTaskDueFilter
    };
    setSelectedRecord((current) =>
      sameSelectedRecord(current, nextRecord) ? current : nextRecord
    );
  }, [searchParams]);

  const replaceWorkspaceRoute = useCallback(
    (updates: {
      view?: ViewMode;
      record?: SelectedRecordRef | null;
      taskStatusFilter?: TaskStatusFilter;
      taskOwnerFilter?: TaskOwnerFilter;
      taskDueFilter?: TaskDueFilter;
    }) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      if (updates.view) {
        nextParams.set("view", updates.view);
      }

      if ("record" in updates) {
        if (updates.record) {
          nextParams.set("record", serializeSelectedRecord(updates.record));
        } else {
          nextParams.delete("record");
        }
      }

      if (updates.taskStatusFilter) {
        setDefaultableParam(nextParams, "taskStatus", updates.taskStatusFilter, "all");
      }

      if (updates.taskOwnerFilter) {
        setDefaultableParam(nextParams, "taskOwner", updates.taskOwnerFilter, "all");
      }

      if (updates.taskDueFilter) {
        setDefaultableParam(nextParams, "taskDue", updates.taskDueFilter, "all");
      }

      const queryString = nextParams.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const changeViewMode = useCallback(
    (nextViewMode: ViewMode) => {
      setViewMode(nextViewMode);
      replaceWorkspaceRoute({ view: nextViewMode });
    },
    [replaceWorkspaceRoute]
  );

  const openRecordDetail = useCallback(
    (record: SelectedRecordRef, nextViewMode?: ViewMode) => {
      if (nextViewMode) {
        setViewMode(nextViewMode);
      }
      setSelectedRecord(record);
      replaceWorkspaceRoute(nextViewMode ? { view: nextViewMode, record } : { record });
    },
    [replaceWorkspaceRoute]
  );

  const closeRecordDetail = useCallback(() => {
    setSelectedRecord(null);
    replaceWorkspaceRoute({ record: null });
  }, [replaceWorkspaceRoute]);

  const copyWorkspaceLink = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      setToolbarMessage("Link copied");
    } catch {
      setToolbarMessage(link);
    }
  }, []);

  const applyDashboard = useCallback((dashboard: DashboardResponse) => {
    setAccounts(dashboard.accounts);
    setLeads(dashboard.leads);
    setOpportunities(dashboard.opportunities);
    setContacts(dashboard.contacts);
    setTasks(dashboard.tasks);
    setNotes(dashboard.notes);
    setActivities(dashboard.activities);
    setCustomFieldDefinitions(dashboard.customFieldDefinitions);
  }, []);

  const changeTaskQueueFilters = useCallback(
    (updates: {
      taskStatusFilter?: TaskStatusFilter;
      taskOwnerFilter?: TaskOwnerFilter;
      taskDueFilter?: TaskDueFilter;
    }) => {
      const nextFilters = {
        ...taskFilterRef.current,
        ...updates
      };
      taskFilterRef.current = nextFilters;
      setTaskStatusFilter(nextFilters.taskStatusFilter);
      setTaskOwnerFilter(nextFilters.taskOwnerFilter);
      setTaskDueFilter(nextFilters.taskDueFilter);
      replaceWorkspaceRoute(nextFilters);
    },
    [replaceWorkspaceRoute]
  );

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

  const selectedRecordDetail = useMemo(() => {
    if (!selectedRecord) {
      return null;
    }

    if (selectedRecord.entityType === "account") {
      const account = accountsById.get(selectedRecord.id);
      return account ? { entityType: "account" as const, record: account } : null;
    }

    if (selectedRecord.entityType === "contact") {
      const contact = contactsById.get(selectedRecord.id);
      return contact ? { entityType: "contact" as const, record: contact } : null;
    }

    if (selectedRecord.entityType === "lead") {
      const lead = leads.find((candidate) => candidate.id === selectedRecord.id);
      return lead ? { entityType: "lead" as const, record: lead } : null;
    }

    const opportunity = opportunities.find((candidate) => candidate.id === selectedRecord.id);
    return opportunity ? { entityType: "opportunity" as const, record: opportunity } : null;
  }, [accountsById, contactsById, leads, opportunities, selectedRecord]);

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
  const dataPermissions = useMemo<DataPermissions>(
    () => deriveDataPermissions(session, !apiBaseUrl),
    [apiBaseUrl, session]
  );
  const createPermissions = useMemo<CreatePermissions>(
    () => deriveCreatePermissions(session, !apiBaseUrl),
    [apiBaseUrl, session]
  );
  const timelinePermissions = useMemo<TimelinePermissions>(
    () => deriveTimelinePermissions(session, !apiBaseUrl),
    [apiBaseUrl, session]
  );
  const canCreateInCurrentView = canCreateForView(createPermissions, viewMode);

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

  const refreshDashboard = useCallback(async () => {
    if (refreshingDashboard) {
      return;
    }

    setRefreshingDashboard(true);
    setToolbarMessage("");
    try {
      if (!apiBaseUrl) {
        applyDashboard(initialDashboard);
        setToolbarMessage("Workspace refreshed");
        return;
      }

      const client = await authenticatedClient();
      if (!client) {
        throw new Error("Session is unavailable");
      }

      const dashboard = await client.dashboard();
      applyDashboard(dashboard);
      setToolbarMessage("Workspace refreshed");
    } catch (error) {
      setToolbarMessage(errorSummary(error));
    } finally {
      setRefreshingDashboard(false);
    }
  }, [apiBaseUrl, applyDashboard, authenticatedClient, initialDashboard, refreshingDashboard]);

  const openLeadCreate = useCallback(() => {
    if (!createPermissions.canCreateLeads) {
      setToolbarMessage("Lead creation is not permitted");
      return;
    }

    setLeadCreateOpen(true);
    setLeadMessage("");
    changeViewMode("leads");
  }, [changeViewMode, createPermissions.canCreateLeads]);

  const openAccountCreate = useCallback(() => {
    if (!createPermissions.canCreateAccounts) {
      setToolbarMessage("Account creation is not permitted");
      return;
    }

    setAccountCreateOpen(true);
    setAccountMessage("");
    changeViewMode("accounts");
  }, [changeViewMode, createPermissions.canCreateAccounts]);

  const openContactCreate = useCallback(() => {
    if (!createPermissions.canCreateContacts) {
      setToolbarMessage("Contact creation is not permitted");
      return;
    }

    setContactCreateOpen(true);
    setContactMessage("");
    changeViewMode("contacts");
  }, [changeViewMode, createPermissions.canCreateContacts]);

  const openOpportunityCreate = useCallback(() => {
    if (!createPermissions.canCreateOpportunities) {
      setToolbarMessage("Opportunity creation is not permitted");
      return;
    }

    setOpportunityCreateOpen(true);
    setOpportunityMessage("");
    changeViewMode("pipeline");
  }, [changeViewMode, createPermissions.canCreateOpportunities]);

  const openContextualCreate = useCallback(() => {
    if (viewMode === "pipeline") {
      openOpportunityCreate();
      return;
    }

    if (viewMode === "accounts") {
      openAccountCreate();
      return;
    }

    if (viewMode === "contacts") {
      openContactCreate();
      return;
    }

    if (viewMode === "leads") {
      openLeadCreate();
      return;
    }

    setToolbarMessage("No create action is available in this view");
  }, [openAccountCreate, openContactCreate, openLeadCreate, openOpportunityCreate, viewMode]);

  useEffect(() => {
    void ensureSession();
  }, [ensureSession]);

  useEffect(() => {
    if (!toolbarMessage || toolbarMessage.startsWith("http")) {
      return;
    }

    const timeout = window.setTimeout(() => setToolbarMessage(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [toolbarMessage]);

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
    if (!timelinePermissions.canUpdateTask(task)) {
      return;
    }

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

  async function createFollowUpTask(input: CreateTaskInput) {
    if (!apiBaseUrl) {
      const now = new Date().toISOString();
      const task: Task = {
        id: crypto.randomUUID(),
        parent: input.parent,
        title: input.title,
        description: input.description ?? null,
        status: "open",
        priority: input.priority,
        dueAt: input.dueAt ?? null,
        assignedUserId: input.assignedUserId,
        tenantId: seedTenantId,
        createdAt: now,
        updatedAt: now,
        createdBy: seedManagerId,
        updatedBy: seedManagerId,
        version: 1,
        archivedAt: null
      };
      setTasks((current) => [task, ...current]);
      return task;
    }

    const client = await authenticatedClient();
    if (!client) {
      throw new Error("Session is unavailable");
    }

    const task = await client.createTask(input);
    setTasks((current) => [task, ...current]);
    return task;
  }

  async function updateRecordTask(id: string, input: UpdateTaskInput) {
    if (!apiBaseUrl) {
      const now = new Date().toISOString();
      const currentTask = tasks.find((task) => task.id === id);
      if (!currentTask || currentTask.version !== input.expectedVersion) {
        throw new Error("Version conflict");
      }
      const updatedTask: Task = {
        ...currentTask,
        title: input.title ?? currentTask.title,
        description:
          input.description === undefined ? currentTask.description : input.description ?? null,
        priority: input.priority ?? currentTask.priority,
        dueAt: input.dueAt === undefined ? currentTask.dueAt : input.dueAt ?? null,
        updatedAt: now,
        updatedBy: seedManagerId,
        version: currentTask.version + 1
      };

      setTasks((current) => current.map((task) => (task.id === updatedTask.id ? updatedTask : task)));
      return updatedTask;
    }

    const client = await authenticatedClient();
    if (!client) {
      throw new Error("Session is unavailable");
    }

    const task = await client.updateTask(id, input);
    setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
    return task;
  }

  async function appendRecordNote(input: AppendNoteInput) {
    if (!apiBaseUrl) {
      const now = new Date().toISOString();
      const note: Note = {
        id: crypto.randomUUID(),
        parent: input.parent,
        body: input.body,
        bodyFormat: input.bodyFormat,
        tenantId: seedTenantId,
        createdAt: now,
        updatedAt: now,
        createdBy: seedManagerId,
        updatedBy: seedManagerId,
        version: 1,
        archivedAt: null
      };
      setNotes((current) => [note, ...current]);
      return note;
    }

    const client = await authenticatedClient();
    if (!client) {
      throw new Error("Session is unavailable");
    }

    const note = await client.appendNote(input);
    setNotes((current) => [note, ...current]);
    return note;
  }

  async function updateRecordNote(id: string, input: UpdateNoteInput) {
    if (!apiBaseUrl) {
      const now = new Date().toISOString();
      const currentNote = notes.find((note) => note.id === id);
      if (!currentNote || currentNote.version !== input.expectedVersion) {
        throw new Error("Version conflict");
      }
      const updatedNote: Note = {
        ...currentNote,
        body: input.body,
        bodyFormat: input.bodyFormat ?? currentNote.bodyFormat,
        updatedAt: now,
        updatedBy: seedManagerId,
        version: currentNote.version + 1
      };

      setNotes((current) => current.map((note) => (note.id === updatedNote.id ? updatedNote : note)));
      return updatedNote;
    }

    const client = await authenticatedClient();
    if (!client) {
      throw new Error("Session is unavailable");
    }

    const note = await client.updateNote(id, input);
    setNotes((current) => current.map((item) => (item.id === note.id ? note : item)));
    return note;
  }

  async function logRecordActivity(input: CreateActivityInput) {
    if (!apiBaseUrl) {
      const now = new Date().toISOString();
      const activity: CRMActivity = {
        id: crypto.randomUUID(),
        parent: input.parent,
        type: input.type,
        subject: input.subject,
        occurredAt: input.occurredAt ?? now,
        payload: input.payload,
        tenantId: seedTenantId,
        createdAt: now,
        updatedAt: now,
        createdBy: seedManagerId,
        updatedBy: seedManagerId,
        version: 1,
        archivedAt: null
      };
      setActivities((current) => [activity, ...current]);
      return activity;
    }

    const client = await authenticatedClient();
    if (!client) {
      throw new Error("Session is unavailable");
    }

    const activity = await client.createActivity(input);
    setActivities((current) => [activity, ...current]);
    return activity;
  }

  async function updateRecordActivity(id: string, input: UpdateActivityInput) {
    if (!apiBaseUrl) {
      const now = new Date().toISOString();
      const currentActivity = activities.find((activity) => activity.id === id);
      if (!currentActivity || currentActivity.version !== input.expectedVersion) {
        throw new Error("Version conflict");
      }
      const updatedActivity: CRMActivity = {
        ...currentActivity,
        subject: input.subject ?? currentActivity.subject,
        payload: input.payload ?? currentActivity.payload,
        updatedAt: now,
        updatedBy: seedManagerId,
        version: currentActivity.version + 1
      };

      setActivities((current) =>
        current.map((activity) => (activity.id === updatedActivity.id ? updatedActivity : activity))
      );
      return updatedActivity;
    }

    const client = await authenticatedClient();
    if (!client) {
      throw new Error("Session is unavailable");
    }

    const activity = await client.updateActivity(id, input);
    setActivities((current) => current.map((item) => (item.id === activity.id ? activity : item)));
    return activity;
  }

  async function createAccountFromToolbar() {
    if (!createPermissions.canCreateAccounts) {
      setAccountMessage("Account creation is not permitted");
      return;
    }

    const input = accountCreateInput(accountCreateDraft);
    if (!input || creatingAccount) {
      return;
    }

    setCreatingAccount(true);
    setAccountMessage("");
    try {
      let account: Account;
      if (!apiBaseUrl) {
        const now = new Date().toISOString();
        account = {
          id: crypto.randomUUID(),
          name: input.name,
          domain: input.domain,
          ownerUserId: seedManagerId,
          status: input.status ?? "prospect",
          customFields: input.customFields ?? {},
          tenantId: seedTenantId,
          createdAt: now,
          updatedAt: now,
          createdBy: seedManagerId,
          updatedBy: seedManagerId,
          version: 1,
          archivedAt: null
        };
      } else {
        const client = await authenticatedClient();
        if (!client) {
          throw new Error("Session is unavailable");
        }
        account = await client.createAccount(input);
      }

      setAccounts((current) => [account, ...current]);
      setAccountCreateDraft(emptyAccountCreateDraft());
      setAccountCreateOpen(false);
      setAccountMessage(`Created ${account.name}`);
      openRecordDetail({ entityType: "account", id: account.id }, "accounts");
    } catch (error) {
      setAccountMessage(errorSummary(error));
    } finally {
      setCreatingAccount(false);
    }
  }

  async function createContactFromToolbar() {
    if (!createPermissions.canCreateContacts) {
      setContactMessage("Contact creation is not permitted");
      return;
    }

    const input = contactCreateInput(contactCreateDraft);
    if (!input || creatingContact) {
      return;
    }

    setCreatingContact(true);
    setContactMessage("");
    try {
      let contact: Contact;
      if (!apiBaseUrl) {
        const now = new Date().toISOString();
        contact = {
          id: crypto.randomUUID(),
          accountId: input.accountId ?? null,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          ownerUserId: seedManagerId,
          customFields: input.customFields ?? {},
          tenantId: seedTenantId,
          createdAt: now,
          updatedAt: now,
          createdBy: seedManagerId,
          updatedBy: seedManagerId,
          version: 1,
          archivedAt: null
        };
      } else {
        const client = await authenticatedClient();
        if (!client) {
          throw new Error("Session is unavailable");
        }
        contact = await client.createContact(input);
      }

      setContacts((current) => [contact, ...current]);
      setContactCreateDraft(emptyContactCreateDraft());
      setContactCreateOpen(false);
      setContactMessage(`Created ${contact.firstName} ${contact.lastName}`);
      openRecordDetail({ entityType: "contact", id: contact.id }, "contacts");
    } catch (error) {
      setContactMessage(errorSummary(error));
    } finally {
      setCreatingContact(false);
    }
  }

  async function createLeadFromToolbar() {
    if (!createPermissions.canCreateLeads) {
      setLeadMessage("Lead creation is not permitted");
      return;
    }

    const input = leadCreateInput(leadCreateDraft);
    if (!input || creatingLead) {
      return;
    }

    setCreatingLead(true);
    setLeadMessage("");
    try {
      let lead: Lead;
      if (!apiBaseUrl) {
        const now = new Date().toISOString();
        lead = {
          id: crypto.randomUUID(),
          source: input.source,
          companyName: input.companyName,
          contactName: input.contactName,
          email: input.email,
          status: input.status ?? "new",
          customFields: input.customFields ?? {},
          tenantId: seedTenantId,
          createdAt: now,
          updatedAt: now,
          createdBy: seedManagerId,
          updatedBy: seedManagerId,
          version: 1,
          archivedAt: null
        };
      } else {
        const client = await authenticatedClient();
        if (!client) {
          throw new Error("Session is unavailable");
        }
        lead = await client.createLead(input);
      }

      setLeads((current) => [lead, ...current]);
      setLeadCreateDraft(emptyLeadCreateDraft());
      setLeadCreateOpen(false);
      setLeadMessage(`Created ${lead.contactName}`);
      openRecordDetail({ entityType: "lead", id: lead.id }, "leads");
    } catch (error) {
      setLeadMessage(errorSummary(error));
    } finally {
      setCreatingLead(false);
    }
  }

  async function createOpportunityFromToolbar() {
    if (!createPermissions.canCreateOpportunities) {
      setOpportunityMessage("Opportunity creation is not permitted");
      return;
    }

    const input = opportunityCreateInput(
      opportunityCreateDraft,
      session?.user.id ?? seedManagerId
    );
    if (!input || creatingOpportunity) {
      return;
    }

    setCreatingOpportunity(true);
    setOpportunityMessage("");
    try {
      let opportunity: Opportunity;
      if (!apiBaseUrl) {
        const now = new Date().toISOString();
        opportunity = {
          id: crypto.randomUUID(),
          accountId: input.accountId,
          primaryContactId: input.primaryContactId ?? null,
          name: input.name,
          stage: input.stage ?? "qualification",
          amount: input.amount ?? null,
          currency: input.currency ?? "USD",
          expectedCloseDate: input.expectedCloseDate ?? null,
          ownerUserId: input.ownerUserId,
          probabilityPct: input.probabilityPct ?? null,
          customFields: input.customFields ?? {},
          tenantId: seedTenantId,
          createdAt: now,
          updatedAt: now,
          createdBy: seedManagerId,
          updatedBy: seedManagerId,
          version: 1,
          archivedAt: null
        };
      } else {
        const client = await authenticatedClient();
        if (!client) {
          throw new Error("Session is unavailable");
        }
        opportunity = await client.createOpportunity(input);
      }

      setOpportunities((current) => [opportunity, ...current]);
      setOpportunityCreateDraft(emptyOpportunityCreateDraft());
      setOpportunityCreateOpen(false);
      setOpportunityMessage(`Created ${opportunity.name}`);
      openRecordDetail({ entityType: "opportunity", id: opportunity.id }, "pipeline");
    } catch (error) {
      setOpportunityMessage(errorSummary(error));
    } finally {
      setCreatingOpportunity(false);
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

    if (!canExportEntity(dataPermissions, entity)) {
      setDataMessage("Export is not permitted");
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

    if (!dataPermissions.canImportContacts) {
      setDataMessage("Import preview is not permitted");
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

    if (!dataPermissions.canImportContacts) {
      setDataMessage("Import is not permitted");
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
            onClick={() => changeViewMode("pipeline")}
          >
            <CircleDollarSign size={18} /> Pipeline
          </button>
          <button
            className={viewMode === "leads" ? "active" : ""}
            onClick={() => changeViewMode("leads")}
          >
            <UserPlus size={18} /> Leads
          </button>
          <button
            className={viewMode === "accounts" ? "active" : ""}
            onClick={() => changeViewMode("accounts")}
          >
            <Building2 size={18} /> Accounts
          </button>
          <button
            className={viewMode === "contacts" ? "active" : ""}
            onClick={() => changeViewMode("contacts")}
          >
            <UserRound size={18} /> Contacts
          </button>
          <button
            className={viewMode === "data" ? "active" : ""}
            onClick={() => changeViewMode("data")}
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
          <div className="toolbar-stack">
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
              <button
                className="icon-button"
                title="Refresh"
                aria-label="Refresh"
                disabled={refreshingDashboard}
                onClick={refreshDashboard}
              >
                <RefreshCcw size={18} />
              </button>
              <button
                className="icon-button"
                title="Copy workspace link"
                aria-label="Copy workspace link"
                onClick={copyWorkspaceLink}
              >
                <Copy size={18} />
              </button>
              <button
                className="command-button"
                disabled={!canCreateInCurrentView}
                onClick={openContextualCreate}
              >
                <Plus size={18} /> New
              </button>
            </div>
            {toolbarMessage ? (
              <p className={toolbarMessage.startsWith("http") ? "toolbar-fallback" : "toolbar-status"}>
                {toolbarMessage}
              </p>
            ) : null}
          </div>
        </header>

        <div className="content-grid">
          <section className="main-panel" aria-label={viewModeTitle(viewMode)}>
            {viewMode === "pipeline" ? (
              <>
                {opportunityCreateOpen ? (
                  <OpportunityCreateForm
                    accounts={accounts}
                    contacts={contacts}
                    busy={creatingOpportunity}
                    draft={opportunityCreateDraft}
                    onCancel={() => {
                      setOpportunityCreateOpen(false);
                      setOpportunityCreateDraft(emptyOpportunityCreateDraft());
                    }}
                    onChange={setOpportunityCreateDraft}
                    onSubmit={createOpportunityFromToolbar}
                  />
                ) : null}
                <PipelineView
                  accountsById={accountsById}
                  customFieldDefinitions={customFieldsByEntity.get("opportunity") ?? []}
                  filteredOpportunities={filteredOpportunities}
                  message={opportunityMessage}
                  stageFilter={stageFilter}
                  syncingId={syncingId}
                  onAdvance={advanceOpportunity}
                  onOpenRecord={(opportunity) =>
                    openRecordDetail(
                      { entityType: "opportunity", id: opportunity.id },
                      "pipeline"
                    )
                  }
                  onStageFilter={setStageFilter}
                />
              </>
            ) : null}

            {viewMode === "leads" ? (
              <>
                {leadCreateOpen ? (
                  <LeadCreateForm
                    busy={creatingLead}
                    draft={leadCreateDraft}
                    onCancel={() => {
                      setLeadCreateOpen(false);
                      setLeadCreateDraft(emptyLeadCreateDraft());
                    }}
                    onChange={setLeadCreateDraft}
                    onSubmit={createLeadFromToolbar}
                  />
                ) : null}
                <LeadsView
                  convertingLeadId={convertingLeadId}
                  leads={filteredLeads}
                  message={leadMessage}
                  onConvert={convertLeadToOpportunity}
                  onOpenRecord={(lead) =>
                    openRecordDetail({ entityType: "lead", id: lead.id }, "leads")
                  }
                />
              </>
            ) : null}

            {viewMode === "accounts" ? (
              <>
                {accountCreateOpen ? (
                  <AccountCreateForm
                    busy={creatingAccount}
                    draft={accountCreateDraft}
                    onCancel={() => {
                      setAccountCreateOpen(false);
                      setAccountCreateDraft(emptyAccountCreateDraft());
                    }}
                    onChange={setAccountCreateDraft}
                    onSubmit={createAccountFromToolbar}
                  />
                ) : null}
                <AccountsView
                  accounts={filteredAccounts}
                  customFieldDefinitions={customFieldsByEntity.get("account") ?? []}
                  message={accountMessage}
                  opportunities={opportunities}
                  onOpenRecord={(account) =>
                    openRecordDetail({ entityType: "account", id: account.id }, "accounts")
                  }
                />
              </>
            ) : null}

            {viewMode === "contacts" ? (
              <>
                {contactCreateOpen ? (
                  <ContactCreateForm
                    accounts={accounts}
                    busy={creatingContact}
                    draft={contactCreateDraft}
                    onCancel={() => {
                      setContactCreateOpen(false);
                      setContactCreateDraft(emptyContactCreateDraft());
                    }}
                    onChange={setContactCreateDraft}
                    onSubmit={createContactFromToolbar}
                  />
                ) : null}
                <ContactsView
                  accountsById={accountsById}
                  contacts={filteredContacts}
                  customFieldDefinitions={customFieldsByEntity.get("contact") ?? []}
                  message={contactMessage}
                  onOpenRecord={(contact) =>
                    openRecordDetail({ entityType: "contact", id: contact.id }, "contacts")
                  }
                />
              </>
            ) : null}

            {viewMode === "data" ? (
              <DataView
                contactCsv={contactCsv}
                customFieldDefinitions={customFieldDefinitions}
                customFieldDraft={customFieldDraft}
                dataBusy={dataBusy}
                dataMessage={dataMessage}
                dataPermissions={dataPermissions}
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
            {selectedRecordDetail ? (
              <RecordDetailPanel
                accountsById={accountsById}
                customFieldDefinitions={
                  customFieldsByEntity.get(selectedRecordDetail.entityType) ?? []
                }
                customFieldMessage={customFieldMessage}
                customFieldValueDrafts={customFieldValueDrafts}
                entityType={selectedRecordDetail.entityType}
                activities={activities}
                leads={leads}
                notes={notes}
                opportunities={opportunities}
                record={selectedRecordDetail.record}
                savingCustomFieldRecordId={savingCustomFieldRecordId}
                tasks={tasks}
                timelinePermissions={timelinePermissions}
                currentUserId={session?.user.id ?? seedManagerId}
                onClose={closeRecordDetail}
                onAppendNote={appendRecordNote}
                onCreateActivity={logRecordActivity}
                onCreateTask={createFollowUpTask}
                onUpdateActivity={updateRecordActivity}
                onUpdateNote={updateRecordNote}
                onUpdateTask={updateRecordTask}
                onCustomFieldDraftChange={updateCustomFieldDraftValue}
                onSaveCustomFields={saveRecordCustomFields}
              />
            ) : null}
            <TaskQueue
              tasks={tasks}
              accountsById={accountsById}
              contactsById={contactsById}
              currentUserId={session?.user.id ?? seedManagerId}
              dueFilter={taskDueFilter}
              leads={leads}
              opportunities={opportunities}
              ownerFilter={taskOwnerFilter}
              statusFilter={taskStatusFilter}
              timelinePermissions={timelinePermissions}
              onComplete={completeTask}
              onFilterChange={changeTaskQueueFilters}
              onUpdateTask={updateRecordTask}
            />
            <Timeline
              activities={activities}
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

function LeadCreateForm({
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

function RecordCreatePanel({
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

function RecordCreateActions({
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

function LeadsView({
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

function PipelineView(props: {
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

function OpportunityCreateForm({
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

function AccountCreateForm({
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

function AccountsView({
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

function ContactCreateForm({
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

function ContactsView({
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

function DataView({
  contactCsv,
  customFieldDefinitions,
  customFieldDraft,
  dataBusy,
  dataMessage,
  dataPermissions,
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
  dataPermissions: DataPermissions;
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
            <button
              disabled={
                dataBusy || !dataPermissions.canImportContacts || contactCsv.trim().length === 0
              }
              onClick={onPreview}
            >
              <Search size={16} /> Preview
            </button>
            <button
              className="primary-action"
              disabled={
                dataBusy ||
                !dataPermissions.canImportContacts ||
                !importPreview ||
                importPreview.errors.length > 0
              }
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

function RecordDetailPanel({
  accountsById,
  customFieldDefinitions,
  customFieldMessage,
  customFieldValueDrafts,
  entityType,
  activities,
  leads,
  notes,
  opportunities,
  record,
  savingCustomFieldRecordId,
  tasks,
  timelinePermissions,
  currentUserId,
  onClose,
  onAppendNote,
  onCreateActivity,
  onCreateTask,
  onUpdateActivity,
  onUpdateNote,
  onUpdateTask,
  onCustomFieldDraftChange,
  onSaveCustomFields
}: {
  accountsById: Map<string, Account>;
  customFieldDefinitions: CustomFieldDefinition[];
  customFieldMessage: string;
  customFieldValueDrafts: CustomFieldValueDrafts;
  entityType: RecordEntityType;
  activities: CRMActivity[];
  leads: Lead[];
  notes: Note[];
  opportunities: Opportunity[];
  record: CustomFieldRecord;
  savingCustomFieldRecordId: string | null;
  tasks: Task[];
  timelinePermissions: TimelinePermissions;
  currentUserId: string;
  onClose: () => void;
  onAppendNote: (input: AppendNoteInput) => Promise<Note>;
  onCreateActivity: (input: CreateActivityInput) => Promise<CRMActivity>;
  onCreateTask: (input: CreateTaskInput) => Promise<Task>;
  onUpdateActivity: (id: string, input: UpdateActivityInput) => Promise<CRMActivity>;
  onUpdateNote: (id: string, input: UpdateNoteInput) => Promise<Note>;
  onUpdateTask: (id: string, input: UpdateTaskInput) => Promise<Task>;
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
  const relatedOpportunities =
    entityType === "account"
      ? opportunities.filter((opportunity) => opportunity.accountId === record.id)
      : [];
  const opportunityAccount =
    entityType === "opportunity" ? accountsById.get((record as Opportunity).accountId) : undefined;
  const contactAccount =
    entityType === "contact" && (record as Contact).accountId
      ? accountsById.get((record as Contact).accountId ?? "")
      : undefined;
  const contactOpportunities =
    entityType === "contact"
      ? opportunities.filter((opportunity) => opportunity.primaryContactId === record.id)
      : [];
  const convertedLeadOpportunity =
    entityType === "lead" && (record as Lead).convertedOpportunityId
      ? opportunities.find((opportunity) => opportunity.id === (record as Lead).convertedOpportunityId)
      : undefined;
  const matchingLead = entityType === "lead" ? leads.find((lead) => lead.id === record.id) : undefined;
  const pipelineTotal = relatedOpportunities.reduce(
    (sum, opportunity) => sum + (opportunity.amount ?? 0),
    0
  );
  const recordNotes = notes.filter(
    (note) => note.parent.type === entityType && note.parent.id === record.id
  );
  const recordActivities = activities.filter(
    (activity) => activity.parent.type === entityType && activity.parent.id === record.id
  );
  const recordTasks = tasks.filter(
    (task) => task.parent?.type === entityType && task.parent.id === record.id
  );
  const recordTimelineItems: TimelineItem[] = [
    ...recordActivities.map((activity) => ({
      id: activity.id,
      at: activity.occurredAt,
      category: "activity" as const,
      kind: activity.type,
      label: "Activity",
      title: activity.subject,
      detail: activityPayloadSummary(activity),
      activity
    })),
    ...recordNotes.map((note) => ({
      id: note.id,
      at: note.createdAt,
      category: "note" as const,
      kind: "note",
      label: "Note",
      title: note.body,
      detail: note.bodyFormat.replace("_", " "),
      note
    })),
    ...recordTasks.map((task) => ({
      id: task.id,
      at: task.dueAt ?? task.createdAt,
      category: "task" as const,
      kind: "task",
      label: "Task",
      title: task.title,
      detail: taskTimelineDetail(task),
      task
    }))
  ].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("all");
  const filteredTimelineItems =
    timelineFilter === "all"
      ? recordTimelineItems
      : recordTimelineItems.filter((item) => item.category === timelineFilter);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const visibleTimelineItems = timelineExpanded
    ? filteredTimelineItems
    : filteredTimelineItems.slice(0, 6);
  const hiddenTimelineCount = Math.max(filteredTimelineItems.length - visibleTimelineItems.length, 0);
  const [taskDraft, setTaskDraft] = useState({
    title: "",
    description: "",
    dueAt: "",
    priority: "medium" as Task["priority"]
  });
  const [taskMessage, setTaskMessage] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskEditDraft, setTaskEditDraft] = useState<TaskEditDraft>(() => emptyTaskEditDraft());
  const [taskEditMessage, setTaskEditMessage] = useState("");
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteMessage, setNoteMessage] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteEditBody, setNoteEditBody] = useState("");
  const [noteEditMessage, setNoteEditMessage] = useState("");
  const [savingNoteEdit, setSavingNoteEdit] = useState(false);
  const [activityDraft, setActivityDraft] = useState({
    type: "call" as CRMActivity["type"],
    subject: "",
    payload: emptyActivityPayloadDraft()
  });
  const [activityMessage, setActivityMessage] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityEditDraft, setActivityEditDraft] = useState<ActivityEditDraft>(() => ({
    subject: "",
    payload: emptyActivityPayloadDraft()
  }));
  const [activityEditMessage, setActivityEditMessage] = useState("");
  const [savingActivityEdit, setSavingActivityEdit] = useState(false);

  useEffect(() => {
    setTaskDraft({
      title: "",
      description: "",
      dueAt: "",
      priority: "medium"
    });
    setTaskMessage("");
    setEditingTaskId(null);
    setTaskEditDraft(emptyTaskEditDraft());
    setTaskEditMessage("");
    setNoteBody("");
    setNoteMessage("");
    setEditingNoteId(null);
    setNoteEditBody("");
    setNoteEditMessage("");
    setActivityDraft({
      type: "call",
      subject: "",
      payload: emptyActivityPayloadDraft()
    });
    setActivityMessage("");
    setEditingActivityId(null);
    setActivityEditDraft({
      subject: "",
      payload: emptyActivityPayloadDraft()
    });
    setActivityEditMessage("");
    setTimelineFilter("all");
    setTimelineExpanded(false);
  }, [entityType, record.id]);

  async function submitTask() {
    if (!timelinePermissions.canCreateTasks) {
      setTaskMessage("Task creation is not permitted");
      return;
    }

    const title = taskDraft.title.trim();
    if (!title || creatingTask) {
      return;
    }

    setCreatingTask(true);
    setTaskMessage("");
    try {
      await onCreateTask({
        parent: { type: entityType, id: record.id },
        title,
        description: taskDraft.description.trim() || undefined,
        priority: taskDraft.priority,
        dueAt: taskDraft.dueAt || undefined,
        assignedUserId: currentUserId
      });
      setTaskDraft({
        title: "",
        description: "",
        dueAt: "",
        priority: "medium"
      });
      setTaskMessage("Task added");
    } catch (error) {
      setTaskMessage(errorSummary(error));
    } finally {
      setCreatingTask(false);
    }
  }

  function startTaskEdit(task: Task) {
    if (!timelinePermissions.canUpdateTask(task)) {
      setTaskEditMessage("Task correction is not permitted");
      return;
    }

    setEditingTaskId(task.id);
    setTaskEditDraft({
      title: task.title,
      description: task.description ?? "",
      dueAt: dateInputValue(task.dueAt),
      priority: task.priority
    });
    setTaskEditMessage("");
  }

  function cancelTaskEdit() {
    setEditingTaskId(null);
    setTaskEditDraft(emptyTaskEditDraft());
    setTaskEditMessage("");
  }

  async function submitTaskEdit(task: Task) {
    if (!timelinePermissions.canUpdateTask(task)) {
      setTaskEditMessage("Task correction is not permitted");
      return;
    }

    const title = taskEditDraft.title.trim();
    if (!title || savingTaskEdit) {
      return;
    }

    setSavingTaskEdit(true);
    setTaskEditMessage("");
    try {
      await onUpdateTask(task.id, {
        expectedVersion: task.version,
        title,
        description: taskEditDraft.description.trim() || null,
        priority: taskEditDraft.priority,
        dueAt: taskEditDraft.dueAt || null
      });
      cancelTaskEdit();
    } catch (error) {
      setTaskEditMessage(errorSummary(error));
    } finally {
      setSavingTaskEdit(false);
    }
  }

  async function submitNote() {
    if (!timelinePermissions.canCreateNotes) {
      setNoteMessage("Note creation is not permitted");
      return;
    }

    const body = noteBody.trim();
    if (!body || savingNote) {
      return;
    }

    setSavingNote(true);
    setNoteMessage("");
    try {
      await onAppendNote({
        parent: { type: entityType, id: record.id },
        body,
        bodyFormat: "plain_text"
      });
      setNoteBody("");
      setNoteMessage("Note saved");
    } catch (error) {
      setNoteMessage(errorSummary(error));
    } finally {
      setSavingNote(false);
    }
  }

  function startNoteEdit(note: Note) {
    if (!timelinePermissions.canUpdateNote(note)) {
      setNoteEditMessage("Note correction is not permitted");
      return;
    }

    setEditingNoteId(note.id);
    setNoteEditBody(note.body);
    setNoteEditMessage("");
  }

  function cancelNoteEdit() {
    setEditingNoteId(null);
    setNoteEditBody("");
    setNoteEditMessage("");
  }

  async function submitNoteEdit(note: Note) {
    if (!timelinePermissions.canUpdateNote(note)) {
      setNoteEditMessage("Note correction is not permitted");
      return;
    }

    const body = noteEditBody.trim();
    if (!body || savingNoteEdit) {
      return;
    }

    setSavingNoteEdit(true);
    setNoteEditMessage("");
    try {
      await onUpdateNote(note.id, {
        expectedVersion: note.version,
        body,
        bodyFormat: note.bodyFormat
      });
      cancelNoteEdit();
    } catch (error) {
      setNoteEditMessage(errorSummary(error));
    } finally {
      setSavingNoteEdit(false);
    }
  }

  async function submitActivity() {
    if (!timelinePermissions.canCreateActivities) {
      setActivityMessage("Activity logging is not permitted");
      return;
    }

    const subject = activityDraft.subject.trim();
    if (!subject || savingActivity) {
      return;
    }

    setSavingActivity(true);
    setActivityMessage("");
    try {
      await onCreateActivity({
        parent: { type: entityType, id: record.id },
        type: activityDraft.type,
        subject,
        payload: buildActivityPayload(activityDraft.type, activityDraft.payload)
      });
      setActivityDraft({
        type: "call",
        subject: "",
        payload: emptyActivityPayloadDraft()
      });
      setActivityMessage("Activity logged");
    } catch (error) {
      setActivityMessage(errorSummary(error));
    } finally {
      setSavingActivity(false);
    }
  }

  function startActivityEdit(activity: CRMActivity) {
    if (!timelinePermissions.canUpdateActivity(activity)) {
      setActivityEditMessage("Activity correction is not permitted");
      return;
    }

    setEditingActivityId(activity.id);
    setActivityEditDraft({
      subject: activity.subject,
      payload: activityPayloadDraftFromActivity(activity)
    });
    setActivityEditMessage("");
  }

  function cancelActivityEdit() {
    setEditingActivityId(null);
    setActivityEditDraft({
      subject: "",
      payload: emptyActivityPayloadDraft()
    });
    setActivityEditMessage("");
  }

  async function submitActivityEdit(activity: CRMActivity) {
    if (!timelinePermissions.canUpdateActivity(activity)) {
      setActivityEditMessage("Activity correction is not permitted");
      return;
    }

    const subject = activityEditDraft.subject.trim();
    if (!subject || savingActivityEdit) {
      return;
    }

    setSavingActivityEdit(true);
    setActivityEditMessage("");
    try {
      await onUpdateActivity(activity.id, {
        expectedVersion: activity.version,
        subject,
        payload: buildActivityPayload(activity.type, activityEditDraft.payload)
      });
      cancelActivityEdit();
    } catch (error) {
      setActivityEditMessage(errorSummary(error));
    } finally {
      setSavingActivityEdit(false);
    }
  }

  return (
    <section className="queue-panel detail-panel" aria-label="Record detail">
      <div className="detail-header">
        <div>
          <p className="eyebrow">{entityType}</p>
          <h3>{recordLabel(record)}</h3>
        </div>
        <button className="icon-button compact" title="Close detail" aria-label="Close detail" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="detail-grid">
        {entityType === "account" ? (
          <>
            <DetailMetric label="Status" value={(record as Account).status} />
            <DetailMetric label="Domain" value={(record as Account).domain ?? ""} />
            <DetailMetric label="Open pipeline" value={formatCurrency(pipelineTotal)} />
            <DetailMetric label="Opportunities" value={String(relatedOpportunities.length)} />
          </>
        ) : null}
        {entityType === "contact" ? (
          <>
            <DetailMetric label="Account" value={contactAccount?.name ?? ""} />
            <DetailMetric label="Email" value={(record as Contact).email ?? ""} />
            <DetailMetric label="Phone" value={(record as Contact).phone ?? ""} />
            <DetailMetric label="Opportunities" value={String(contactOpportunities.length)} />
          </>
        ) : null}
        {entityType === "lead" ? (
          <>
            <DetailMetric label="Status" value={(record as Lead).status} />
            <DetailMetric label="Company" value={(record as Lead).companyName ?? ""} />
            <DetailMetric label="Source" value={(record as Lead).source} />
            <DetailMetric label="Converted" value={formatDate((record as Lead).convertedAt)} />
          </>
        ) : null}
        {entityType === "opportunity" ? (
          <>
            <DetailMetric label="Stage" value={(record as Opportunity).stage} />
            <DetailMetric label="Account" value={opportunityAccount?.name ?? ""} />
            <DetailMetric label="Amount" value={formatCurrency((record as Opportunity).amount ?? 0)} />
            <DetailMetric label="Close" value={formatDate((record as Opportunity).expectedCloseDate)} />
          </>
        ) : null}
      </div>

      <section className="detail-section" aria-label="Create follow-up task">
        <div>
          <p className="eyebrow">Follow-up</p>
          <h4>Create task</h4>
        </div>
        <div className="task-composer">
          <label>
            <span>Title</span>
            <input
              value={taskDraft.title}
              onChange={(event) =>
                setTaskDraft((current) => ({ ...current, title: event.target.value }))
              }
              placeholder={`Follow up with ${recordLabel(record)}`}
            />
          </label>
          <div className="task-composer-row">
            <label>
              <span>Due</span>
              <input
                type="date"
                value={taskDraft.dueAt}
                onChange={(event) =>
                  setTaskDraft((current) => ({ ...current, dueAt: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Priority</span>
              <select
                value={taskDraft.priority}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    priority: event.target.value as Task["priority"]
                  }))
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
          <label>
            <span>Description</span>
            <textarea
              value={taskDraft.description}
              onChange={(event) =>
                setTaskDraft((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Context for the next touch"
            />
          </label>
          <button
            className="table-action"
            disabled={
              creatingTask || !timelinePermissions.canCreateTasks || taskDraft.title.trim().length === 0
            }
            onClick={submitTask}
          >
            <Plus size={16} /> Add task
          </button>
        </div>
        {taskMessage ? <p className="data-message">{taskMessage}</p> : null}
      </section>

      <section className="detail-section" aria-label="Record notes">
        <div>
          <p className="eyebrow">Notes</p>
          <h4>Record notes</h4>
        </div>
        <div className="note-composer">
          <label>
            <span>Note</span>
            <textarea
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder={`Add context for ${recordLabel(record)}`}
            />
          </label>
          <button
            className="table-action"
            disabled={savingNote || !timelinePermissions.canCreateNotes || noteBody.trim().length === 0}
            onClick={submitNote}
          >
            <Plus size={16} /> Save note
          </button>
        </div>
        {noteMessage ? <p className="data-message">{noteMessage}</p> : null}
      </section>

      <section className="detail-section" aria-label="Log activity">
        <div>
          <p className="eyebrow">Activity</p>
          <h4>Log activity</h4>
        </div>
        <div className="activity-composer">
          <div className="task-composer-row">
            <label>
              <span>Type</span>
              <select
                value={activityDraft.type}
                onChange={(event) =>
                  setActivityDraft((current) => ({
                    ...current,
                    type: event.target.value as CRMActivity["type"],
                    payload: emptyActivityPayloadDraft()
                  }))
                }
              >
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
                <option value="event">Event</option>
              </select>
            </label>
            <label>
              <span>Subject</span>
              <input
                value={activityDraft.subject}
                onChange={(event) =>
                  setActivityDraft((current) => ({ ...current, subject: event.target.value }))
                }
                placeholder={`Logged touch with ${recordLabel(record)}`}
              />
            </label>
          </div>
          <ActivityPayloadFields
            draft={activityDraft.payload}
            type={activityDraft.type}
            onChange={(payload) => setActivityDraft((current) => ({ ...current, payload }))}
          />
          <button
            className="table-action"
            disabled={
              savingActivity ||
              !timelinePermissions.canCreateActivities ||
              activityDraft.subject.trim().length === 0
            }
            onClick={submitActivity}
          >
            <Plus size={16} /> Log activity
          </button>
        </div>
        {activityMessage ? <p className="data-message">{activityMessage}</p> : null}
      </section>

      <section className="detail-section" aria-label="Record timeline">
        <div>
          <p className="eyebrow">History</p>
          <h4>Record timeline</h4>
        </div>
        <div className="segmented timeline-filter" aria-label="Timeline filter">
          {(["all", "activity", "note", "task"] as const).map((filter) => (
            <button
              className={timelineFilter === filter ? "selected" : ""}
              key={filter}
              onClick={() => {
                setTimelineFilter(filter);
                setTimelineExpanded(false);
              }}
            >
              {timelineFilterLabel(filter)}
            </button>
          ))}
        </div>
        <div className="detail-list">
          {visibleTimelineItems.map((item) => (
            <div className="detail-list-row timeline-record-row" key={`${item.kind}:${item.id}`}>
              <div className="timeline-record-meta">
                <StatusPill value={item.label} />
                <span>{formatDateTime(item.at)}</span>
              </div>
              {editingTaskId === item.id && item.task ? (
                <div className="activity-edit-form">
                  <label>
                    <span>Title</span>
                    <input
                      value={taskEditDraft.title}
                      onChange={(event) =>
                        setTaskEditDraft((current) => ({
                          ...current,
                          title: event.target.value
                        }))
                      }
                    />
                  </label>
                  <div className="activity-payload-grid">
                    <label>
                      <span>Due</span>
                      <input
                        type="date"
                        value={taskEditDraft.dueAt}
                        onChange={(event) =>
                          setTaskEditDraft((current) => ({ ...current, dueAt: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      <span>Priority</span>
                      <select
                        value={taskEditDraft.priority}
                        onChange={(event) =>
                          setTaskEditDraft((current) => ({
                            ...current,
                            priority: event.target.value as Task["priority"]
                          }))
                        }
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    <span>Description</span>
                    <textarea
                      value={taskEditDraft.description}
                      onChange={(event) =>
                        setTaskEditDraft((current) => ({
                          ...current,
                          description: event.target.value
                        }))
                      }
                    />
                  </label>
                  <div className="activity-edit-actions">
                    <button
                      className="table-action"
                      disabled={
                        savingTaskEdit ||
                        !timelinePermissions.canUpdateTask(item.task) ||
                        taskEditDraft.title.trim().length === 0
                      }
                      onClick={() => {
                        if (item.task) {
                          submitTaskEdit(item.task);
                        }
                      }}
                    >
                      <Check size={16} /> Save correction
                    </button>
                    <button className="table-action ghost" onClick={cancelTaskEdit}>
                      <X size={16} /> Cancel
                    </button>
                  </div>
                  {taskEditMessage ? <p className="data-message">{taskEditMessage}</p> : null}
                </div>
              ) : editingNoteId === item.id && item.note ? (
                <div className="activity-edit-form">
                  <label>
                    <span>Note</span>
                    <textarea
                      value={noteEditBody}
                      onChange={(event) => setNoteEditBody(event.target.value)}
                    />
                  </label>
                  <div className="activity-edit-actions">
                    <button
                      className="table-action"
                      disabled={
                        savingNoteEdit ||
                        !timelinePermissions.canUpdateNote(item.note) ||
                        noteEditBody.trim().length === 0
                      }
                      onClick={() => {
                        if (item.note) {
                          submitNoteEdit(item.note);
                        }
                      }}
                    >
                      <Check size={16} /> Save correction
                    </button>
                    <button className="table-action ghost" onClick={cancelNoteEdit}>
                      <X size={16} /> Cancel
                    </button>
                  </div>
                  {noteEditMessage ? <p className="data-message">{noteEditMessage}</p> : null}
                </div>
              ) : editingActivityId === item.id && item.activity ? (
                <div className="activity-edit-form">
                  <label>
                    <span>Subject</span>
                    <input
                      value={activityEditDraft.subject}
                      onChange={(event) =>
                        setActivityEditDraft((current) => ({
                          ...current,
                          subject: event.target.value
                        }))
                      }
                    />
                  </label>
                  {item.activity ? (
                    <ActivityPayloadFields
                      draft={activityEditDraft.payload}
                      type={item.activity.type}
                      onChange={(payload) =>
                        setActivityEditDraft((current) => ({ ...current, payload }))
                      }
                    />
                  ) : null}
                  <div className="activity-edit-actions">
                    <button
                      className="table-action"
                      disabled={
                        savingActivityEdit ||
                        !timelinePermissions.canUpdateActivity(item.activity) ||
                        activityEditDraft.subject.trim().length === 0
                      }
                      onClick={() => {
                        if (item.activity) {
                          submitActivityEdit(item.activity);
                        }
                      }}
                    >
                      <Check size={16} /> Save correction
                    </button>
                    <button className="table-action ghost" onClick={cancelActivityEdit}>
                      <X size={16} /> Cancel
                    </button>
                  </div>
                  {activityEditMessage ? <p className="data-message">{activityEditMessage}</p> : null}
                </div>
              ) : (
                <>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                  {item.activity ? (
                    <button
                      className="timeline-edit-button"
                      disabled={!timelinePermissions.canUpdateActivity(item.activity)}
                      onClick={() => {
                        if (item.activity) {
                          startActivityEdit(item.activity);
                        }
                      }}
                    >
                      <Pencil size={14} /> Edit activity
                    </button>
                  ) : null}
                  {item.note ? (
                    <button
                      className="timeline-edit-button"
                      disabled={!timelinePermissions.canUpdateNote(item.note)}
                      onClick={() => {
                        if (item.note) {
                          startNoteEdit(item.note);
                        }
                      }}
                    >
                      <Pencil size={14} /> Edit note
                    </button>
                  ) : null}
                  {item.task ? (
                    <button
                      className="timeline-edit-button"
                      disabled={!timelinePermissions.canUpdateTask(item.task)}
                      onClick={() => {
                        if (item.task) {
                          startTaskEdit(item.task);
                        }
                      }}
                    >
                      <Pencil size={14} /> Edit task
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ))}
          {filteredTimelineItems.length === 0 ? (
            <p className="detail-empty">{timelineEmptyMessage(timelineFilter)}</p>
          ) : null}
          {filteredTimelineItems.length > 6 ? (
            <button
              className="timeline-more-button"
              onClick={() => setTimelineExpanded((current) => !current)}
            >
              {timelineExpanded ? "Show fewer" : `Show ${hiddenTimelineCount} older`}
            </button>
          ) : null}
        </div>
      </section>

      <section className="detail-section" aria-label="Custom field values">
        <div>
          <p className="eyebrow">Custom fields</p>
          <h4>Record values</h4>
        </div>
        <CustomFieldValueEditor
          definitions={customFieldDefinitions}
          drafts={customFieldValueDrafts}
          entityType={entityType}
          record={record}
          savingRecordId={savingCustomFieldRecordId}
          onDraftChange={onCustomFieldDraftChange}
          onSave={onSaveCustomFields}
        />
        {customFieldDefinitions.length === 0 ? (
          <p className="detail-empty">No fields defined for this record type</p>
        ) : null}
        {customFieldMessage ? <p className="data-message">{customFieldMessage}</p> : null}
      </section>

      {entityType === "account" ? (
        <section className="detail-section" aria-label="Related opportunities">
          <div>
            <p className="eyebrow">Pipeline</p>
            <h4>Related opportunities</h4>
          </div>
          <div className="detail-list">
            {relatedOpportunities.map((opportunity) => (
              <div className="detail-list-row" key={opportunity.id}>
                <strong>{opportunity.name}</strong>
                <span>{stageLabels[opportunity.stage]}</span>
                <span>{formatCurrency(opportunity.amount ?? 0)}</span>
              </div>
            ))}
            {relatedOpportunities.length === 0 ? (
              <p className="detail-empty">No opportunities</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {entityType === "contact" ? (
        <section className="detail-section" aria-label="Contact opportunities">
          <div>
            <p className="eyebrow">Pipeline</p>
            <h4>Contact opportunities</h4>
          </div>
          <div className="detail-list">
            {contactOpportunities.map((opportunity) => (
              <div className="detail-list-row" key={opportunity.id}>
                <strong>{opportunity.name}</strong>
                <span>{stageLabels[opportunity.stage]}</span>
                <span>{formatCurrency(opportunity.amount ?? 0)}</span>
              </div>
            ))}
            {contactOpportunities.length === 0 ? (
              <p className="detail-empty">No linked opportunities</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {entityType === "lead" && matchingLead ? (
        <section className="detail-section" aria-label="Lead conversion">
          <div>
            <p className="eyebrow">Conversion</p>
            <h4>Converted records</h4>
          </div>
          <div className="detail-list">
            {convertedLeadOpportunity ? (
              <div className="detail-list-row">
                <strong>{convertedLeadOpportunity.name}</strong>
                <span>{stageLabels[convertedLeadOpportunity.stage]}</span>
                <span>{formatCurrency(convertedLeadOpportunity.amount ?? 0)}</span>
              </div>
            ) : (
              <p className="detail-empty">
                {matchingLead.status === "converted"
                  ? "Converted opportunity is not in the current workspace data"
                  : "Not converted yet"}
              </p>
            )}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-metric">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function TaskQueue({
  tasks,
  opportunities,
  accountsById,
  contactsById,
  currentUserId,
  dueFilter,
  leads,
  ownerFilter,
  statusFilter,
  timelinePermissions,
  onComplete,
  onFilterChange,
  onUpdateTask
}: {
  tasks: Task[];
  opportunities: Opportunity[];
  accountsById: Map<string, Account>;
  contactsById: Map<string, Contact>;
  currentUserId: string;
  dueFilter: TaskDueFilter;
  leads: Lead[];
  ownerFilter: TaskOwnerFilter;
  statusFilter: TaskStatusFilter;
  timelinePermissions: TimelinePermissions;
  onComplete: (task: Task) => void;
  onFilterChange: (updates: {
    taskStatusFilter?: TaskStatusFilter;
    taskOwnerFilter?: TaskOwnerFilter;
    taskDueFilter?: TaskDueFilter;
  }) => void;
  onUpdateTask: (id: string, input: UpdateTaskInput) => Promise<Task>;
}) {
  const opportunityById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));
  const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskEditDraft, setTaskEditDraft] = useState<TaskEditDraft>(() => emptyTaskEditDraft());
  const [taskEditMessage, setTaskEditMessage] = useState("");
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);
  const filteredTasks = tasks.filter(
    (task) =>
      (statusFilter === "all" || task.status === statusFilter) &&
      (ownerFilter === "all" || task.assignedUserId === currentUserId) &&
      taskMatchesDueFilter(task, dueFilter)
  );

  function startEdit(task: Task) {
    if (!timelinePermissions.canUpdateTask(task)) {
      setTaskEditMessage("Task correction is not permitted");
      return;
    }

    setEditingTaskId(task.id);
    setTaskEditDraft(taskEditDraftFromTask(task));
    setTaskEditMessage("");
  }

  function cancelEdit() {
    setEditingTaskId(null);
    setTaskEditDraft(emptyTaskEditDraft());
    setTaskEditMessage("");
  }

  async function saveEdit(task: Task) {
    if (!timelinePermissions.canUpdateTask(task)) {
      setTaskEditMessage("Task correction is not permitted");
      return;
    }

    const title = taskEditDraft.title.trim();
    if (!title || savingTaskEdit) {
      return;
    }

    setSavingTaskEdit(true);
    setTaskEditMessage("");
    try {
      await onUpdateTask(task.id, {
        expectedVersion: task.version,
        title,
        description: taskEditDraft.description.trim() || null,
        dueAt: taskEditDraft.dueAt || null,
        priority: taskEditDraft.priority
      });
      cancelEdit();
    } catch (error) {
      setTaskEditMessage(errorSummary(error));
    } finally {
      setSavingTaskEdit(false);
    }
  }

  return (
    <section className="queue-panel" aria-label="Tasks">
      <div className="panel-heading small">
        <div>
          <p className="eyebrow">Tasks</p>
          <h3>Today and next</h3>
        </div>
        <ClipboardCheck size={18} aria-hidden="true" />
      </div>
      <div className="task-queue-filters" aria-label="Task queue filters">
        <label>
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => {
              cancelEdit();
              onFilterChange({ taskStatusFilter: event.target.value as TaskStatusFilter });
            }}
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label>
          <span>Owner</span>
          <select
            value={ownerFilter}
            onChange={(event) => {
              cancelEdit();
              onFilterChange({ taskOwnerFilter: event.target.value as TaskOwnerFilter });
            }}
          >
            <option value="all">All owners</option>
            <option value="mine">My tasks</option>
          </select>
        </label>
        <label>
          <span>Due</span>
          <select
            value={dueFilter}
            onChange={(event) => {
              cancelEdit();
              onFilterChange({ taskDueFilter: event.target.value as TaskDueFilter });
            }}
          >
            <option value="all">All dates</option>
            <option value="overdue">Overdue</option>
            <option value="today">Today</option>
            <option value="upcoming">Upcoming</option>
            <option value="none">No due date</option>
          </select>
        </label>
      </div>
      <p className="task-filter-summary">
        Showing {filteredTasks.length} of {tasks.length} tasks
      </p>
      <div className="task-list">
        {filteredTasks.length === 0 ? <p className="data-message">No tasks match these filters.</p> : null}
        {filteredTasks.map((task) => {
          const parentOpportunity =
            task.parent?.type === "opportunity" ? opportunityById.get(task.parent.id) : undefined;
          const parentAccount =
            task.parent?.type === "account"
              ? accountsById.get(task.parent.id)
              : parentOpportunity
                ? accountsById.get(parentOpportunity.accountId)
                : undefined;
          const parentContact =
            task.parent?.type === "contact" ? contactsById.get(task.parent.id) : undefined;
          const parentLead = task.parent?.type === "lead" ? leadsById.get(task.parent.id) : undefined;
          const parentName =
            parentAccount?.name ??
            (parentContact ? `${parentContact.firstName} ${parentContact.lastName}` : undefined) ??
            parentLead?.contactName ??
            "Unlinked";

          return (
            <article className={`task-item ${task.status === "done" ? "done" : ""}`} key={task.id}>
              {editingTaskId === task.id ? (
                <div className="task-queue-edit-form">
                  <label>
                    <span>Title</span>
                    <input
                      value={taskEditDraft.title}
                      onChange={(event) =>
                        setTaskEditDraft((current) => ({ ...current, title: event.target.value }))
                      }
                    />
                  </label>
                  <div className="activity-payload-grid">
                    <label>
                      <span>Due</span>
                      <input
                        type="date"
                        value={taskEditDraft.dueAt}
                        onChange={(event) =>
                          setTaskEditDraft((current) => ({ ...current, dueAt: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      <span>Priority</span>
                      <select
                        value={taskEditDraft.priority}
                        onChange={(event) =>
                          setTaskEditDraft((current) => ({
                            ...current,
                            priority: event.target.value as Task["priority"]
                          }))
                        }
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    <span>Description</span>
                    <textarea
                      value={taskEditDraft.description}
                      onChange={(event) =>
                        setTaskEditDraft((current) => ({
                          ...current,
                          description: event.target.value
                        }))
                      }
                    />
                  </label>
                  <div className="activity-edit-actions">
                    <button
                      className="table-action"
                      disabled={
                        savingTaskEdit ||
                        !timelinePermissions.canUpdateTask(task) ||
                        taskEditDraft.title.trim().length === 0
                      }
                      onClick={() => saveEdit(task)}
                    >
                      <Check size={16} /> Save
                    </button>
                    <button className="table-action ghost" onClick={cancelEdit}>
                      <X size={16} /> Cancel
                    </button>
                  </div>
                  {taskEditMessage ? <p className="data-message">{taskEditMessage}</p> : null}
                </div>
              ) : (
                <>
                  <div>
                    <h4>{task.title}</h4>
                    <p>{parentName}</p>
                    <span>{taskTimelineDetail(task)}</span>
                  </div>
                  <div className="task-item-actions">
                    <button
                      className="icon-button compact"
                      title="Edit task"
                      aria-label={`Edit ${task.title}`}
                      disabled={task.status === "done" || !timelinePermissions.canUpdateTask(task)}
                      onClick={() => startEdit(task)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button compact"
                      title="Complete task"
                      aria-label={`Complete ${task.title}`}
                      disabled={task.status === "done" || !timelinePermissions.canUpdateTask(task)}
                      onClick={() => onComplete(task)}
                    >
                      <Check size={16} />
                    </button>
                  </div>
                </>
              )}
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
              <p>{[parentLabel(activity), activityPayloadSummary(activity)].filter(Boolean).join(" / ")}</p>
              <span>{formatDate(activity.occurredAt)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActivityPayloadFields({
  draft,
  type,
  onChange
}: {
  draft: ActivityPayloadDraft;
  type: CRMActivity["type"];
  onChange: (draft: ActivityPayloadDraft) => void;
}) {
  const update = (patch: Partial<ActivityPayloadDraft>) => onChange({ ...draft, ...patch });

  if (type === "call") {
    return (
      <div className="activity-payload-grid">
        <label>
          <span>Outcome</span>
          <input
            value={draft.outcome}
            onChange={(event) => update({ outcome: event.target.value })}
            placeholder="Qualified, left voicemail, no answer"
          />
        </label>
        <label>
          <span>Duration</span>
          <input
            inputMode="numeric"
            value={draft.durationMinutes}
            onChange={(event) => update({ durationMinutes: event.target.value })}
            placeholder="Minutes"
          />
        </label>
      </div>
    );
  }

  if (type === "email") {
    return (
      <div className="activity-payload-grid">
        <label>
          <span>Direction</span>
          <select
            value={draft.emailDirection}
            onChange={(event) =>
              update({ emailDirection: event.target.value as ActivityPayloadDraft["emailDirection"] })
            }
          >
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
          </select>
        </label>
        <label>
          <span>Outcome</span>
          <input
            value={draft.outcome}
            onChange={(event) => update({ outcome: event.target.value })}
            placeholder="Replied, booked, waiting"
          />
        </label>
      </div>
    );
  }

  if (type === "meeting" || type === "event") {
    return (
      <div className="activity-payload-grid">
        <label>
          <span>{type === "meeting" ? "Attendees" : "Guests"}</span>
          <input
            value={draft.attendees}
            onChange={(event) => update({ attendees: event.target.value })}
            placeholder="Comma-separated names"
          />
        </label>
        <label>
          <span>{type === "meeting" ? "Duration" : "Location"}</span>
          <input
            value={type === "meeting" ? draft.durationMinutes : draft.location}
            onChange={(event) =>
              update(
                type === "meeting"
                  ? { durationMinutes: event.target.value }
                  : { location: event.target.value }
              )
            }
            placeholder={type === "meeting" ? "Minutes" : "Venue or channel"}
          />
        </label>
      </div>
    );
  }

  return null;
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

function parseViewMode(value: string | null): ViewMode | null {
  if (
    value === "pipeline" ||
    value === "leads" ||
    value === "accounts" ||
    value === "contacts" ||
    value === "data"
  ) {
    return value;
  }

  return null;
}

function parseTaskStatusFilter(value: string | null): TaskStatusFilter {
  if (
    value === "open" ||
    value === "in_progress" ||
    value === "done" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "all";
}

function parseTaskOwnerFilter(value: string | null): TaskOwnerFilter {
  return value === "mine" ? "mine" : "all";
}

function parseTaskDueFilter(value: string | null): TaskDueFilter {
  if (value === "overdue" || value === "today" || value === "upcoming" || value === "none") {
    return value;
  }

  return "all";
}

function setDefaultableParam(params: URLSearchParams, key: string, value: string, defaultValue: string) {
  if (value === defaultValue) {
    params.delete(key);
    return;
  }

  params.set(key, value);
}

function parseSelectedRecord(value: string | null): SelectedRecordRef | null {
  if (!value) {
    return null;
  }

  const [entityType, id] = value.split(":");
  if (!id) {
    return null;
  }

  if (
    entityType === "account" ||
    entityType === "contact" ||
    entityType === "lead" ||
    entityType === "opportunity"
  ) {
    return { entityType, id };
  }

  return null;
}

function serializeSelectedRecord(record: SelectedRecordRef) {
  return `${record.entityType}:${record.id}`;
}

function sameSelectedRecord(
  left: SelectedRecordRef | null,
  right: SelectedRecordRef | null
) {
  return left?.entityType === right?.entityType && left?.id === right?.id;
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

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function timelineFilterLabel(filter: TimelineFilter) {
  switch (filter) {
    case "activity":
      return "Activities";
    case "note":
      return "Notes";
    case "task":
      return "Tasks";
    default:
      return "All";
  }
}

function timelineEmptyMessage(filter: TimelineFilter) {
  return filter === "all" ? "No timeline entries yet" : `No ${timelineFilterLabel(filter).toLowerCase()} yet`;
}

function emptyTaskEditDraft(): TaskEditDraft {
  return {
    title: "",
    description: "",
    dueAt: "",
    priority: "medium"
  };
}

function taskEditDraftFromTask(task: Task): TaskEditDraft {
  return {
    title: task.title,
    description: task.description ?? "",
    dueAt: dateInputValue(task.dueAt),
    priority: task.priority
  };
}

function dateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function taskTimelineDetail(task: Task) {
  return [
    task.status.replace("_", " "),
    task.priority,
    task.dueAt ? `due ${formatDate(task.dueAt)}` : ""
  ].filter(Boolean).join(" / ");
}

function taskMatchesDueFilter(task: Task, filter: TaskDueFilter) {
  if (filter === "all") {
    return true;
  }

  if (!task.dueAt) {
    return filter === "none";
  }

  if (filter === "none") {
    return false;
  }

  const dueDate = new Date(task.dueAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (filter === "overdue") {
    return dueDate < today;
  }

  if (filter === "today") {
    return dueDate >= today && dueDate < tomorrow;
  }

  return dueDate >= tomorrow;
}

function emptyActivityPayloadDraft(): ActivityPayloadDraft {
  return {
    outcome: "",
    durationMinutes: "",
    attendees: "",
    emailDirection: "outbound",
    location: ""
  };
}

function activityPayloadDraftFromActivity(activity: CRMActivity): ActivityPayloadDraft {
  const { payload } = activity;
  const attendees = Array.isArray(payload.attendees)
    ? payload.attendees.filter((attendee): attendee is string => typeof attendee === "string")
    : [];
  const direction =
    payload.direction === "inbound" || payload.direction === "outbound"
      ? payload.direction
      : "outbound";

  return {
    outcome:
      typeof payload.outcome === "string"
        ? payload.outcome
        : typeof payload.disposition === "string"
          ? payload.disposition
          : "",
    durationMinutes:
      typeof payload.durationMinutes === "number" ? String(payload.durationMinutes) : "",
    attendees: attendees.join(", "),
    emailDirection: direction,
    location: typeof payload.location === "string" ? payload.location : ""
  };
}

function buildActivityPayload(
  type: CRMActivity["type"],
  draft: ActivityPayloadDraft
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const outcome = draft.outcome.trim();
  const durationMinutes = Number.parseInt(draft.durationMinutes, 10);
  const attendees = draft.attendees
    .split(",")
    .map((attendee) => attendee.trim())
    .filter(Boolean);
  const location = draft.location.trim();

  if (outcome) {
    payload.outcome = outcome;
  }

  if (Number.isFinite(durationMinutes) && durationMinutes > 0) {
    payload.durationMinutes = durationMinutes;
  }

  if (type === "email") {
    payload.direction = draft.emailDirection;
  }

  if ((type === "meeting" || type === "event") && attendees.length > 0) {
    payload.attendees = attendees;
  }

  if (type === "event" && location) {
    payload.location = location;
  }

  return payload;
}

function activityPayloadSummary(activity: CRMActivity) {
  const details: string[] = [activity.type];
  const { payload } = activity;

  if (typeof payload.direction === "string") {
    details.push(payload.direction);
  }

  if (typeof payload.outcome === "string") {
    details.push(payload.outcome);
  }

  if (typeof payload.disposition === "string") {
    details.push(payload.disposition);
  }

  if (typeof payload.durationMinutes === "number") {
    details.push(`${payload.durationMinutes} min`);
  }

  if (Array.isArray(payload.attendees) && payload.attendees.length > 0) {
    details.push(`${payload.attendees.length} attendees`);
  }

  if (typeof payload.location === "string") {
    details.push(payload.location);
  }

  return details.join(" / ");
}

function errorSummary(error: unknown) {
  if (error instanceof CRMClientError) {
    return `Request failed (${error.status})`;
  }

  return error instanceof Error ? error.message : "Action failed";
}
