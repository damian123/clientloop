"use client";

import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  Copy,
  Database,
  Plus,
  RefreshCcw,
  Search,
  UserPlus,
  UserRound
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AccountImportPreview,
  AppendNoteInput,
  ConferenceCompanyImportPreview,
  ConferenceMeetingImportPreview,
  ConferencePersonImportPreview,
  ContactImportPreview,
  CreateActivityInput,
  CreateTaskInput,
  DashboardResponse,
  ExportEntity,
  OpportunityImportPreview,
  SearchResult,
  SessionResponse,
  UpdateActivityInput,
  UpdateNoteInput,
  UpdateTaskInput
} from "@clientloop/contracts";
import type {
  Account,
  Activity as CRMActivity,
  Conference,
  ConferenceCompany,
  ConferenceMeeting,
  ConferenceOutreachStatus,
  ConferencePerson,
  OpportunityStage,
  Contact,
  CustomFieldDefinition,
  Lead,
  Note,
  Opportunity,
  RecordEntityType,
  Task
} from "@clientloop/domain";
import { opportunityStageOrder, seedManagerId, seedTenantId } from "@clientloop/domain";
import { CRMClient, CRMClientError } from "@clientloop/ui-sdk";
import {
  accountCreateInput,
  contactCreateInput,
  emptyAccountCreateDraft,
  emptyContactCreateDraft,
  emptyLeadCreateDraft,
  emptyOpportunityCreateDraft,
  leadCreateInput,
  opportunityCreateInput,
  type AccountCreateDraft,
  type ContactCreateDraft,
  type LeadCreateDraft,
  type OpportunityCreateDraft
} from "../lib/create-record-inputs";
import {
  canCreateForView,
  canExportEntity,
  deriveCreatePermissions,
  deriveCustomFieldPermissions,
  deriveDataPermissions,
  deriveTimelinePermissions,
  type CreatePermissions,
  type CustomFieldPermissions,
  type DataPermissions,
  type TimelinePermissions
} from "../lib/session-permissions";
import { ConferencesView, ConferenceCreateForm } from "./conference-views";
import { DataView } from "./data-view";
import { NetworkProspectingView } from "./network-view";
import {
  AccountCreateForm,
  AccountsView,
  ContactCreateForm,
  ContactsView,
  LeadCreateForm,
  LeadsView,
  OpportunityCreateForm,
  PipelineView
} from "./record-views";
import { RecordDetailPanel, TaskQueue, Timeline } from "./record-detail-panel";
import {
  conferenceCompanyCsvPlaceholder,
  conferenceMeetingCsvPlaceholder,
  conferencePersonCsvPlaceholder,
  accountCsvPlaceholder,
  contactCsvPlaceholder,
  opportunityCsvPlaceholder,
  type ConferenceCompanyDraft,
  type ConferenceCompanyPatch,
  type ConferenceCreateDraft,
  type ConferenceMeetingDraft,
  type ConferencePersonDraft,
  type ConferencePersonPatch,
  type ConferenceTab,
  type CustomFieldDraft,
  type CustomFieldValueDrafts,
  type SelectedRecordRef,
  type TaskDueFilter,
  type TaskOwnerFilter,
  type TaskStatusFilter,
  type CustomFieldRecord,
  type TimelineFilter,
  type ViewMode
} from "./workspace-model";
import {
  conferenceCompanyInput,
  conferenceCreateInput,
  conferenceMeetingInput,
  conferencePersonInput,
  conferencePriorityBand,
  conferenceTotalScore,
  customFieldDefinitionInput,
  customFieldPatchFromDraft,
  domainFromUrl,
  emptyConferenceCompanyDraft,
  emptyConferenceCreateDraft,
  emptyConferenceMeetingDraft,
  emptyConferencePersonDraft,
  errorSummary,
  formatCurrency,
  formatLabel,
  isNetworkProspectLead,
  isRecordSearchResult,
  leadCustomFieldString,
  outreachStatusRequiresPermission,
  recordDraftKey,
  recordLabel,
  searchableCustomFields,
  splitPersonName,
  parseSelectedRecord,
  parseTaskDueFilter,
  parseTaskOwnerFilter,
  parseTaskStatusFilter,
  parseViewMode,
  sameSelectedRecord,
  searchResultId,
  serializeSelectedRecord,
  setDefaultableParam,
  viewForEntityType,
  viewModeTitle
} from "./workspace-helpers";
import { Metric, SearchResultsPanel } from "./workspace-ui";

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
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(-1);
  const [searchingRecords, setSearchingRecords] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [stageFilter, setStageFilter] = useState<OpportunityStage | "all">("all");
  const [accounts, setAccounts] = useState<Account[]>(initialDashboard.accounts);
  const [leads, setLeads] = useState<Lead[]>(initialDashboard.leads);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(
    initialDashboard.opportunities
  );
  const [conferences, setConferences] = useState<Conference[]>(initialDashboard.conferences);
  const [conferenceCompanies, setConferenceCompanies] = useState<ConferenceCompany[]>(
    initialDashboard.conferenceCompanies
  );
  const [conferencePeople, setConferencePeople] = useState<ConferencePerson[]>(
    initialDashboard.conferencePeople
  );
  const [conferenceMeetings, setConferenceMeetings] = useState<ConferenceMeeting[]>(
    initialDashboard.conferenceMeetings
  );
  const [selectedConferenceId, setSelectedConferenceId] = useState(
    initialDashboard.conferences[0]?.id ?? ""
  );
  const [conferenceTab, setConferenceTab] = useState<ConferenceTab>("companies");
  const [conferenceCreateOpen, setConferenceCreateOpen] = useState(false);
  const [conferenceCreateDraft, setConferenceCreateDraft] = useState<ConferenceCreateDraft>(() =>
    emptyConferenceCreateDraft()
  );
  const [conferenceCompanyDraft, setConferenceCompanyDraft] = useState<ConferenceCompanyDraft>(() =>
    emptyConferenceCompanyDraft()
  );
  const [conferencePersonDraft, setConferencePersonDraft] = useState<ConferencePersonDraft>(() =>
    emptyConferencePersonDraft()
  );
  const [conferenceMeetingDraft, setConferenceMeetingDraft] = useState<ConferenceMeetingDraft>(() =>
    emptyConferenceMeetingDraft()
  );
  const [conferenceCompanyCsv, setConferenceCompanyCsv] = useState("");
  const [conferencePersonCsv, setConferencePersonCsv] = useState("");
  const [conferenceMeetingCsv, setConferenceMeetingCsv] = useState("");
  const [conferenceCompanyImportPreview, setConferenceCompanyImportPreview] =
    useState<ConferenceCompanyImportPreview | null>(null);
  const [conferencePersonImportPreview, setConferencePersonImportPreview] =
    useState<ConferencePersonImportPreview | null>(null);
  const [conferenceMeetingImportPreview, setConferenceMeetingImportPreview] =
    useState<ConferenceMeetingImportPreview | null>(null);
  const [conferenceBusy, setConferenceBusy] = useState(false);
  const [conferenceMessage, setConferenceMessage] = useState("");
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
  const [accountCsv, setAccountCsv] = useState("");
  const [contactCsv, setContactCsv] = useState("");
  const [opportunityCsv, setOpportunityCsv] = useState("");
  const [accountImportPreview, setAccountImportPreview] = useState<AccountImportPreview | null>(null);
  const [importPreview, setImportPreview] = useState<ContactImportPreview | null>(null);
  const [opportunityImportPreview, setOpportunityImportPreview] =
    useState<OpportunityImportPreview | null>(null);
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
    setConferences(dashboard.conferences);
    setConferenceCompanies(dashboard.conferenceCompanies);
    setConferencePeople(dashboard.conferencePeople);
    setConferenceMeetings(dashboard.conferenceMeetings);
    setSelectedConferenceId((current) =>
      dashboard.conferences.some((conference) => conference.id === current)
        ? current
        : dashboard.conferences[0]?.id ?? ""
    );
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

  const conferenceCompaniesById = useMemo(
    () => new Map(conferenceCompanies.map((company) => [company.id, company])),
    [conferenceCompanies]
  );

  const conferencePeopleById = useMemo(
    () => new Map(conferencePeople.map((person) => [person.id, person])),
    [conferencePeople]
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
  const filteredSalesLeads = useMemo(
    () => filteredLeads.filter((lead) => !isNetworkProspectLead(lead)),
    [filteredLeads]
  );
  const filteredNetworkLeads = useMemo(
    () => filteredLeads.filter((lead) => isNetworkProspectLead(lead)),
    [filteredLeads]
  );
  const highPriorityNetworkLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          isNetworkProspectLead(lead) &&
          leadCustomFieldString(lead, "network_priority") === "High"
      ),
    [leads]
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

  const selectedConference = useMemo(
    () =>
      conferences.find((conference) => conference.id === selectedConferenceId) ??
      conferences[0] ??
      null,
    [conferences, selectedConferenceId]
  );
  const selectedConferenceCompanies = useMemo(
    () =>
      selectedConference
        ? conferenceCompanies.filter((company) => company.conferenceId === selectedConference.id)
        : [],
    [conferenceCompanies, selectedConference]
  );
  const selectedConferencePeople = useMemo(
    () =>
      selectedConference
        ? conferencePeople
            .filter((person) => person.conferenceId === selectedConference.id)
            .sort((left, right) => right.totalScore - left.totalScore)
        : [],
    [conferencePeople, selectedConference]
  );
  const selectedConferenceMeetings = useMemo(
    () =>
      selectedConference
        ? conferenceMeetings.filter((meeting) => meeting.conferenceId === selectedConference.id)
        : [],
    [conferenceMeetings, selectedConference]
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
  const openLeads = leads.filter(
    (lead) =>
      !isNetworkProspectLead(lead) &&
      lead.status !== "converted" &&
      lead.status !== "disqualified"
  );
  const highPriorityConferencePeople = conferencePeople.filter(
    (person) => person.priorityBand === "request_meeting"
  );
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
  const customFieldPermissions = useMemo<CustomFieldPermissions>(
    () => deriveCustomFieldPermissions(session, !apiBaseUrl),
    [apiBaseUrl, session]
  );
  const canCreateInCurrentView = canCreateForView(createPermissions, viewMode);
  const devLoginUserId = process.env.NEXT_PUBLIC_DEV_LOGIN_USER_ID ?? seedManagerId;

  const ensureSession = useCallback(async (): Promise<SessionResponse | null> => {
    if (!apiBaseUrl) {
      return null;
    }

    if (
      session?.csrfToken &&
      (process.env.NODE_ENV === "production" || session.user.id === devLoginUserId)
    ) {
      return session;
    }

    if (!sessionPromiseRef.current) {
      const client = new CRMClient({ baseUrl: apiBaseUrl });
      sessionPromiseRef.current = (async () => {
        const existingSession = await client.session().catch(() => null);
        if (
          existingSession?.csrfToken &&
          (process.env.NODE_ENV === "production" || existingSession.user.id === devLoginUserId)
        ) {
          return existingSession;
        }

        try {
          return await client.devLogin({ tenantId: seedTenantId, userId: devLoginUserId });
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
  }, [apiBaseUrl, devLoginUserId, session]);

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

  const openConferenceCreate = useCallback(() => {
    if (!createPermissions.canCreateConferences) {
      setToolbarMessage("Conference creation is not permitted");
      return;
    }

    setConferenceCreateOpen(true);
    setConferenceMessage("");
    changeViewMode("conferences");
  }, [changeViewMode, createPermissions.canCreateConferences]);

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

    if (viewMode === "conferences") {
      openConferenceCreate();
      return;
    }

    setToolbarMessage("No create action is available in this view");
  }, [
    openAccountCreate,
    openConferenceCreate,
    openContactCreate,
    openLeadCreate,
    openOpportunityCreate,
    viewMode
  ]);

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

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!apiBaseUrl || trimmedQuery.length < 2) {
      setSearchResults([]);
      setSearchError("");
      setSearchingRecords(false);
      return;
    }

    let cancelled = false;
    setSearchingRecords(true);
    setSearchError("");
    const timeout = window.setTimeout(() => {
      void authenticatedClient()
        .then((client) => client?.search(trimmedQuery) ?? [])
        .then((results) => {
          if (!cancelled) {
            setSearchResults(results);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setSearchResults([]);
            setSearchError(errorSummary(error));
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearchingRecords(false);
          }
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [apiBaseUrl, authenticatedClient, query]);

  useEffect(() => {
    setActiveSearchResultIndex(searchResults.length > 0 ? 0 : -1);
  }, [searchResults]);

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

  async function createConferenceFromToolbar() {
    if (!createPermissions.canCreateConferences) {
      setConferenceMessage("Conference creation is not permitted");
      return;
    }

    const input = conferenceCreateInput(conferenceCreateDraft);
    if (!input || conferenceBusy) {
      return;
    }

    setConferenceBusy(true);
    setConferenceMessage("");
    try {
      let conference: Conference;
      if (!apiBaseUrl) {
        const now = new Date().toISOString();
        conference = {
          id: crypto.randomUUID(),
          ...input,
          endDate: input.endDate ?? null,
          location: input.location ?? null,
          website: input.website ?? null,
          audienceType: input.audienceType ?? null,
          organizerContact: input.organizerContact ?? null,
          sponsorPackageLink: input.sponsorPackageLink ?? null,
          appName: input.appName ?? null,
          sourceNotes: input.sourceNotes ?? null,
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
        conference = await client.createConference(input);
      }

      setConferences((current) => [conference, ...current]);
      setSelectedConferenceId(conference.id);
      setConferenceCreateDraft(emptyConferenceCreateDraft());
      setConferenceCreateOpen(false);
      setConferenceMessage(`Created ${conference.name}`);
      changeViewMode("conferences");
    } catch (error) {
      setConferenceMessage(errorSummary(error));
    } finally {
      setConferenceBusy(false);
    }
  }

  async function createConferenceCompanyFromForm() {
    if (!selectedConference || conferenceBusy) {
      return;
    }

    const input = conferenceCompanyInput(conferenceCompanyDraft);
    if (!input) {
      setConferenceMessage("Company is required");
      return;
    }

    setConferenceBusy(true);
    setConferenceMessage("");
    try {
      let company: ConferenceCompany;
      if (!apiBaseUrl) {
        const now = new Date().toISOString();
        company = {
          id: crypto.randomUUID(),
          conferenceId: selectedConference.id,
          accountId: null,
          ...input,
          website: input.website ?? null,
          sector: input.sector ?? null,
          sourceUrl: input.sourceUrl ?? null,
          sourceNotes: input.sourceNotes ?? null,
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
        company = await client.createConferenceCompany(selectedConference.id, input);
      }

      setConferenceCompanies((current) => [company, ...current]);
      setConferenceCompanyDraft(emptyConferenceCompanyDraft());
      setConferenceMessage(`Added ${company.company}`);
    } catch (error) {
      setConferenceMessage(errorSummary(error));
    } finally {
      setConferenceBusy(false);
    }
  }

  async function updateConferenceCompanyRecord(
    company: ConferenceCompany,
    patch: ConferenceCompanyPatch
  ) {
    let updated: ConferenceCompany;
    if (!apiBaseUrl) {
      updated = {
        ...company,
        ...patch,
        accountId: patch.accountId === undefined ? company.accountId : patch.accountId,
        company: patch.company ?? company.company,
        website: patch.website === undefined ? company.website : patch.website,
        conferenceRole: patch.conferenceRole ?? company.conferenceRole,
        sector: patch.sector === undefined ? company.sector : patch.sector,
        productFit: patch.productFit ?? company.productFit,
        expansionFit: patch.expansionFit ?? company.expansionFit,
        budgetFit: patch.budgetFit ?? company.budgetFit,
        marketEntryRelevance: patch.marketEntryRelevance ?? company.marketEntryRelevance,
        partnershipRelevance: patch.partnershipRelevance ?? company.partnershipRelevance,
        companyScore: patch.companyScore ?? company.companyScore,
        sourceUrl: patch.sourceUrl === undefined ? company.sourceUrl : patch.sourceUrl,
        sourceNotes: patch.sourceNotes === undefined ? company.sourceNotes : patch.sourceNotes,
        updatedAt: new Date().toISOString(),
        updatedBy: session?.user.id ?? seedManagerId,
        version: company.version + 1
      };
    } else {
      const client = await authenticatedClient();
      if (!client) {
        throw new Error("Session is unavailable");
      }
      updated = await client.updateConferenceCompany(company.id, {
        expectedVersion: company.version,
        ...patch
      });
    }

    setConferenceCompanies((current) =>
      current.map((candidate) => (candidate.id === updated.id ? updated : candidate))
    );
    return updated;
  }

  async function ensureConferenceCompanyAccount(company: ConferenceCompany) {
    if (company.accountId) {
      return accountsById.get(company.accountId) ?? null;
    }

    if (!createPermissions.canCreateAccounts) {
      throw new Error("Account creation is not permitted");
    }

    const now = new Date().toISOString();
    let account: Account;
    const input = {
      name: company.company,
      domain: domainFromUrl(company.website ?? company.sourceUrl ?? undefined),
      status: "prospect" as const,
      customFields: {}
    };

    if (!apiBaseUrl) {
      account = {
        id: crypto.randomUUID(),
        ...input,
        ownerUserId: session?.user.id ?? seedManagerId,
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
    await updateConferenceCompanyRecord(company, { accountId: account.id });
    return account;
  }

  async function createAccountFromConferenceCompany(company: ConferenceCompany) {
    if (conferenceBusy) {
      return;
    }

    setConferenceBusy(true);
    setConferenceMessage("");
    try {
      const account = await ensureConferenceCompanyAccount(company);
      setConferenceMessage(account ? `Linked ${company.company} to ${account.name}` : "Account is already linked");
    } catch (error) {
      setConferenceMessage(errorSummary(error));
    } finally {
      setConferenceBusy(false);
    }
  }

  async function createContactFromConferencePerson(person: ConferencePerson) {
    if (conferenceBusy) {
      return;
    }

    if (person.contactId) {
      setConferenceMessage("Conference person is already linked to a contact");
      return;
    }

    if (!createPermissions.canCreateContacts) {
      setConferenceMessage("Contact creation is not permitted");
      return;
    }

    setConferenceBusy(true);
    setConferenceMessage("");
    try {
      const linkedCompany = person.conferenceCompanyId
        ? conferenceCompaniesById.get(person.conferenceCompanyId)
        : null;
      const account = person.accountId
        ? accountsById.get(person.accountId) ?? null
        : linkedCompany
          ? await ensureConferenceCompanyAccount(linkedCompany)
          : null;
      const name = splitPersonName(person.name);
      const now = new Date().toISOString();
      let contact: Contact;
      const input = {
        accountId: account?.id,
        firstName: name.firstName,
        lastName: name.lastName,
        email: person.email ?? undefined,
        ownerUserId: session?.user.id ?? seedManagerId,
        customFields: {}
      };

      if (!apiBaseUrl) {
        contact = {
          id: crypto.randomUUID(),
          accountId: input.accountId ?? null,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email ?? null,
          phone: null,
          ownerUserId: input.ownerUserId,
          customFields: {},
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
      await updateConferencePersonRecord(person, {
        accountId: account?.id ?? person.accountId ?? null,
        contactId: contact.id
      });
      setConferenceMessage(`Created contact ${contact.firstName} ${contact.lastName}`);
    } catch (error) {
      setConferenceMessage(errorSummary(error));
    } finally {
      setConferenceBusy(false);
    }
  }

  async function createConferencePersonFromForm() {
    if (!selectedConference || conferenceBusy) {
      return;
    }

    const input = conferencePersonInput(conferencePersonDraft);
    if (!input) {
      setConferenceMessage(
        conferencePersonDraft.email.trim() && !conferencePersonDraft.lawfulBasisNotes.trim()
          ? "Lawful basis notes are required when email is stored"
          : "Name and title are required"
      );
      return;
    }

    setConferenceBusy(true);
    setConferenceMessage("");
    try {
      let person: ConferencePerson;
      if (!apiBaseUrl) {
        const now = new Date().toISOString();
        const totalScore = conferenceTotalScore(input);
        person = {
          id: crypto.randomUUID(),
          conferenceId: selectedConference.id,
          conferenceCompanyId: input.conferenceCompanyId ?? null,
          accountId: null,
          contactId: null,
          ...input,
          linkedIn: input.linkedIn ?? null,
          email: input.email ?? null,
          conferenceSignal: input.conferenceSignal ?? null,
          buyingSignal: input.buyingSignal ?? null,
          relationshipPath: input.relationshipPath ?? null,
          source: input.source ?? null,
          lawfulBasisNotes: input.lawfulBasisNotes ?? null,
          outreachStatus: "not_started",
          totalScore,
          priorityBand: conferencePriorityBand(totalScore),
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
        person = await client.createConferencePerson(selectedConference.id, input);
      }

      setConferencePeople((current) => [person, ...current]);
      setConferencePersonDraft(emptyConferencePersonDraft());
      setConferenceMessage(`Added ${person.name}`);
    } catch (error) {
      setConferenceMessage(errorSummary(error));
    } finally {
      setConferenceBusy(false);
    }
  }

  async function createConferenceMeetingFromForm() {
    if (!selectedConference || conferenceBusy) {
      return;
    }

    const input = conferenceMeetingInput(conferenceMeetingDraft);
    if (!input) {
      setConferenceMessage("Meeting person and reason are required");
      return;
    }

    setConferenceBusy(true);
    setConferenceMessage("");
    try {
      let meeting: ConferenceMeeting;
      if (!apiBaseUrl) {
        const now = new Date().toISOString();
        meeting = {
          id: crypto.randomUUID(),
          conferenceId: selectedConference.id,
          ...input,
          proposedAsk: input.proposedAsk ?? null,
          introPath: input.introPath ?? null,
          notes: input.notes ?? null,
          nextStep: input.nextStep ?? null,
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
        meeting = await client.createConferenceMeeting(selectedConference.id, input);
      }

      setConferenceMeetings((current) => [meeting, ...current]);
      setConferenceMeetingDraft(emptyConferenceMeetingDraft());
      setConferenceMessage("Meeting plan added");
    } catch (error) {
      setConferenceMessage(errorSummary(error));
    } finally {
      setConferenceBusy(false);
    }
  }

  async function updateConferencePersonRecord(
    person: ConferencePerson,
    patch: ConferencePersonPatch
  ) {
    if (
      person.optOutStatus === "opted_out" &&
      patch.outreachStatus &&
      outreachStatusRequiresPermission(patch.outreachStatus)
    ) {
      throw new Error("Opted-out people cannot be added to outreach actions");
    }

    let updated: ConferencePerson;
    if (!apiBaseUrl) {
      const seniorityScore = patch.seniorityScore ?? person.seniorityScore;
      const companyFitScore = patch.companyFitScore ?? person.companyFitScore;
      const signalScore = patch.signalScore ?? person.signalScore;
      const conferenceSignalScore = patch.conferenceSignalScore ?? person.conferenceSignalScore;
      const warmIntroScore = patch.warmIntroScore ?? person.warmIntroScore;
      const timingScore = patch.timingScore ?? person.timingScore;
      const totalScore = conferenceTotalScore({
        seniorityScore,
        companyFitScore,
        signalScore,
        conferenceSignalScore,
        warmIntroScore,
        timingScore
      });

      updated = {
        ...person,
        ...patch,
        conferenceCompanyId:
          patch.conferenceCompanyId === undefined
            ? person.conferenceCompanyId
            : patch.conferenceCompanyId,
        accountId: patch.accountId === undefined ? person.accountId : patch.accountId,
        contactId: patch.contactId === undefined ? person.contactId : patch.contactId,
        name: patch.name ?? person.name,
        title: patch.title ?? person.title,
        linkedIn: patch.linkedIn === undefined ? person.linkedIn : patch.linkedIn,
        email: patch.email === undefined ? person.email : patch.email,
        conferenceSignal:
          patch.conferenceSignal === undefined
            ? person.conferenceSignal
            : patch.conferenceSignal,
        icpCategory: patch.icpCategory ?? person.icpCategory,
        buyingSignal:
          patch.buyingSignal === undefined ? person.buyingSignal : patch.buyingSignal,
        relationshipPath:
          patch.relationshipPath === undefined ? person.relationshipPath : patch.relationshipPath,
        outreachStatus: patch.outreachStatus ?? person.outreachStatus,
        sourceType: patch.sourceType ?? person.sourceType,
        source: patch.source === undefined ? person.source : patch.source,
        lawfulBasisNotes:
          patch.lawfulBasisNotes === undefined
            ? person.lawfulBasisNotes
            : patch.lawfulBasisNotes,
        optOutStatus: patch.optOutStatus ?? person.optOutStatus,
        seniorityScore,
        companyFitScore,
        signalScore,
        conferenceSignalScore,
        warmIntroScore,
        timingScore,
        totalScore,
        priorityBand: conferencePriorityBand(totalScore),
        updatedAt: new Date().toISOString(),
        updatedBy: session?.user.id ?? seedManagerId,
        version: person.version + 1
      };
    } else {
      const client = await authenticatedClient();
      if (!client) {
        throw new Error("Session is unavailable");
      }
      updated = await client.updateConferencePerson(person.id, {
        expectedVersion: person.version,
        ...patch
      });
    }

    setConferencePeople((current) =>
      current.map((candidate) => (candidate.id === updated.id ? updated : candidate))
    );
    return updated;
  }

  async function createConferenceFollowUpTask(person: ConferencePerson) {
    await createConferenceFollowUpTasks([person]);
  }

  async function createConferenceFollowUpTasks(peopleToUpdate: ConferencePerson[]) {
    if (conferenceBusy) {
      return;
    }

    if (peopleToUpdate.length === 0) {
      setConferenceMessage("Select at least one conference person");
      return;
    }

    const eligiblePeople = peopleToUpdate.filter((person) => person.optOutStatus !== "opted_out");
    const skippedCount = peopleToUpdate.length - eligiblePeople.length;

    if (eligiblePeople.length === 0) {
      setConferenceMessage("Opted-out people cannot be added to outreach actions");
      return;
    }

    setConferenceBusy(true);
    setConferenceMessage("");
    try {
      for (const person of eligiblePeople) {
        await createFollowUpTask({
          parent: { type: "conference_person", id: person.id },
          title: `Request meeting with ${person.name}`,
          description: [person.title, person.buyingSignal, person.relationshipPath].filter(Boolean).join("\n"),
          priority: person.priorityBand === "request_meeting" ? "high" : "medium",
          assignedUserId: session?.user.id ?? seedManagerId
        });
      }
      setConferenceMessage(
        skippedCount > 0
          ? `Created ${eligiblePeople.length} tasks; skipped ${skippedCount} opted-out people`
          : `Created ${eligiblePeople.length} tasks`
      );
    } catch (error) {
      setConferenceMessage(errorSummary(error));
    } finally {
      setConferenceBusy(false);
    }
  }

  async function bulkSetConferenceOutreachStatus(
    peopleToUpdate: ConferencePerson[],
    outreachStatus: ConferenceOutreachStatus
  ) {
    if (conferenceBusy) {
      return;
    }

    if (peopleToUpdate.length === 0) {
      setConferenceMessage("Select at least one conference person");
      return;
    }

    const eligiblePeople = outreachStatusRequiresPermission(outreachStatus)
      ? peopleToUpdate.filter((person) => person.optOutStatus !== "opted_out")
      : peopleToUpdate;
    const skippedCount = peopleToUpdate.length - eligiblePeople.length;

    if (eligiblePeople.length === 0) {
      setConferenceMessage("Opted-out people cannot be added to outreach actions");
      return;
    }

    setConferenceBusy(true);
    setConferenceMessage("");
    try {
      for (const person of eligiblePeople) {
        await updateConferencePersonRecord(person, { outreachStatus });
      }
      setConferenceMessage(
        skippedCount > 0
          ? `Updated ${eligiblePeople.length} people; skipped ${skippedCount} opted-out people`
          : `Updated ${eligiblePeople.length} people to ${formatLabel(outreachStatus)}`
      );
    } catch (error) {
      setConferenceMessage(errorSummary(error));
    } finally {
      setConferenceBusy(false);
    }
  }

  async function bulkRequestConferenceMeetings(peopleToUpdate: ConferencePerson[]) {
    await bulkSetConferenceOutreachStatus(peopleToUpdate, "meeting_requested");
  }

  async function bulkMarkConferencePeopleOptedOut(peopleToUpdate: ConferencePerson[]) {
    if (conferenceBusy) {
      return;
    }

    if (peopleToUpdate.length === 0) {
      setConferenceMessage("Select at least one conference person");
      return;
    }

    setConferenceBusy(true);
    setConferenceMessage("");
    try {
      for (const person of peopleToUpdate) {
        await updateConferencePersonRecord(person, {
          optOutStatus: "opted_out",
          outreachStatus: "disqualified"
        });
      }
      setConferenceMessage(`Marked ${peopleToUpdate.length} people opted out`);
    } catch (error) {
      setConferenceMessage(errorSummary(error));
    } finally {
      setConferenceBusy(false);
    }
  }

  async function previewConferenceCompaniesCsv() {
    if (!apiBaseUrl || !selectedConference) {
      setConferenceMessage("API is not configured");
      return;
    }

    if (!dataPermissions.canImportConferences) {
      setConferenceMessage("Conference import preview is not permitted");
      return;
    }

    setConferenceBusy(true);
    setConferenceMessage("");
    try {
      const client = await authenticatedClient();
      if (!client) {
        return;
      }
      const preview = await client.previewConferenceCompanyImport(selectedConference.id, {
        csv: conferenceCompanyCsv
      });
      setConferenceCompanyImportPreview(preview);
      setConferenceMessage(`${preview.validRows} valid company rows from ${preview.totalRows}`);
    } catch (error) {
      setConferenceMessage(errorSummary(error));
    } finally {
      setConferenceBusy(false);
    }
  }

  async function importConferenceCompaniesCsv() {
    if (!apiBaseUrl || !selectedConference) {
      setConferenceMessage("API is not configured");
      return;
    }

    if (!dataPermissions.canImportConferences) {
      setConferenceMessage("Conference import is not permitted");
      return;
    }

    setConferenceBusy(true);
    setConferenceMessage("");
    try {
      const client = await authenticatedClient();
      if (!client) {
        return;
      }
      const result = await client.importConferenceCompanies(selectedConference.id, {
        csv: conferenceCompanyCsv
      });
      setConferenceCompanies((current) => [...result.companies, ...current]);
      setConferenceCompanyImportPreview(null);
      setConferenceCompanyCsv("");
      setConferenceMessage(`Imported ${result.importedCount} companies`);
    } catch (error) {
      setConferenceMessage(errorSummary(error));
    } finally {
      setConferenceBusy(false);
    }
  }

  async function previewConferencePeopleCsv() {
    if (!apiBaseUrl || !selectedConference) {
      setConferenceMessage("API is not configured");
      return;
    }

    if (!dataPermissions.canImportConferences) {
      setConferenceMessage("Conference import preview is not permitted");
      return;
    }

    setConferenceBusy(true);
    setConferenceMessage("");
    try {
      const client = await authenticatedClient();
      if (!client) {
        return;
      }
      const preview = await client.previewConferencePersonImport(selectedConference.id, {
        csv: conferencePersonCsv
      });
      setConferencePersonImportPreview(preview);
      setConferenceMessage(`${preview.validRows} valid people rows from ${preview.totalRows}`);
    } catch (error) {
      setConferenceMessage(errorSummary(error));
    } finally {
      setConferenceBusy(false);
    }
  }

  async function importConferencePeopleCsv() {
    if (!apiBaseUrl || !selectedConference) {
      setConferenceMessage("API is not configured");
      return;
    }

    if (!dataPermissions.canImportConferences) {
      setConferenceMessage("Conference import is not permitted");
      return;
    }

    setConferenceBusy(true);
    setConferenceMessage("");
    try {
      const client = await authenticatedClient();
      if (!client) {
        return;
      }
      const result = await client.importConferencePeople(selectedConference.id, {
        csv: conferencePersonCsv
      });
      setConferencePeople((current) => [...result.people, ...current]);
      setConferencePersonImportPreview(null);
      setConferencePersonCsv("");
      setConferenceMessage(`Imported ${result.importedCount} people`);
    } catch (error) {
      setConferenceMessage(errorSummary(error));
    } finally {
      setConferenceBusy(false);
    }
  }

  async function previewConferenceMeetingsCsv() {
    if (!apiBaseUrl || !selectedConference) {
      setConferenceMessage("API is not configured");
      return;
    }

    if (!dataPermissions.canImportConferences) {
      setConferenceMessage("Conference import preview is not permitted");
      return;
    }

    setConferenceBusy(true);
    setConferenceMessage("");
    try {
      const client = await authenticatedClient();
      if (!client) {
        return;
      }
      const preview = await client.previewConferenceMeetingImport(selectedConference.id, {
        csv: conferenceMeetingCsv
      });
      setConferenceMeetingImportPreview(preview);
      setConferenceMessage(`${preview.validRows} valid meeting rows from ${preview.totalRows}`);
    } catch (error) {
      setConferenceMessage(errorSummary(error));
    } finally {
      setConferenceBusy(false);
    }
  }

  async function importConferenceMeetingsCsv() {
    if (!apiBaseUrl || !selectedConference) {
      setConferenceMessage("API is not configured");
      return;
    }

    if (!dataPermissions.canImportConferences) {
      setConferenceMessage("Conference import is not permitted");
      return;
    }

    setConferenceBusy(true);
    setConferenceMessage("");
    try {
      const client = await authenticatedClient();
      if (!client) {
        return;
      }
      const result = await client.importConferenceMeetings(selectedConference.id, {
        csv: conferenceMeetingCsv
      });
      setConferenceMeetings((current) => [...result.meetings, ...current]);
      setConferenceMeetingImportPreview(null);
      setConferenceMeetingCsv("");
      setConferenceMessage(`Imported ${result.importedCount} meetings`);
    } catch (error) {
      setConferenceMessage(errorSummary(error));
    } finally {
      setConferenceBusy(false);
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

  async function previewAccountCsv() {
    if (!apiBaseUrl) {
      setDataMessage("API is not configured");
      return;
    }

    if (!dataPermissions.canImportAccounts) {
      setDataMessage("Account import preview is not permitted");
      return;
    }

    setDataBusy(true);
    setDataMessage("");
    try {
      const client = await authenticatedClient();
      if (!client) {
        return;
      }
      const preview = await client.previewAccountImport({ csv: accountCsv });
      setAccountImportPreview(preview);
      setDataMessage(`${preview.validRows} valid account rows from ${preview.totalRows}`);
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

  async function importAccountCsv() {
    if (!apiBaseUrl) {
      setDataMessage("API is not configured");
      return;
    }

    if (!dataPermissions.canImportAccounts) {
      setDataMessage("Account import is not permitted");
      return;
    }

    setDataBusy(true);
    setDataMessage("");
    try {
      const client = await authenticatedClient();
      if (!client) {
        return;
      }
      const result = await client.importAccounts({ csv: accountCsv });
      setAccounts((current) => [...result.accounts, ...current]);
      setAccountImportPreview(null);
      setAccountCsv("");
      setDataMessage(`Imported ${result.importedCount} accounts`);
    } catch (error) {
      setDataMessage(errorSummary(error));
    } finally {
      setDataBusy(false);
    }
  }

  async function previewOpportunityCsv() {
    if (!apiBaseUrl) {
      setDataMessage("API is not configured");
      return;
    }

    if (!dataPermissions.canImportOpportunities) {
      setDataMessage("Opportunity import preview is not permitted");
      return;
    }

    setDataBusy(true);
    setDataMessage("");
    try {
      const client = await authenticatedClient();
      if (!client) {
        return;
      }
      const preview = await client.previewOpportunityImport({ csv: opportunityCsv });
      setOpportunityImportPreview(preview);
      setDataMessage(`${preview.validRows} valid opportunity rows from ${preview.totalRows}`);
    } catch (error) {
      setDataMessage(errorSummary(error));
    } finally {
      setDataBusy(false);
    }
  }

  async function importOpportunityCsv() {
    if (!apiBaseUrl) {
      setDataMessage("API is not configured");
      return;
    }

    if (!dataPermissions.canImportOpportunities) {
      setDataMessage("Opportunity import is not permitted");
      return;
    }

    setDataBusy(true);
    setDataMessage("");
    try {
      const client = await authenticatedClient();
      if (!client) {
        return;
      }
      const result = await client.importOpportunities({ csv: opportunityCsv });
      setOpportunities((current) => [...result.opportunities, ...current]);
      setOpportunityImportPreview(null);
      setOpportunityCsv("");
      setDataMessage(`Imported ${result.importedCount} opportunities`);
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

    if (!customFieldPermissions.canCreateDefinitions) {
      setDataMessage("Custom field creation is not permitted");
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

    if (!customFieldPermissions.canUpdateRecordValues(entityType, record)) {
      setCustomFieldMessage("Custom field updates are not permitted");
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

  function openSearchResult(result: SearchResult) {
    if (result.type === "conference") {
      setSelectedConferenceId(result.id);
      setSearchResults([]);
      setSearchError("");
      setActiveSearchResultIndex(-1);
      changeViewMode("conferences");
      return;
    }

    if (result.type === "conference_company") {
      const company = conferenceCompanies.find((candidate) => candidate.id === result.id);
      if (company) {
        setSelectedConferenceId(company.conferenceId);
      }
      setSearchResults([]);
      setSearchError("");
      setActiveSearchResultIndex(-1);
      changeViewMode("conferences");
      setConferenceTab("companies");
      return;
    }

    if (result.type === "conference_person") {
      const person = conferencePeople.find((candidate) => candidate.id === result.id);
      if (person) {
        setSelectedConferenceId(person.conferenceId);
      }
      setSearchResults([]);
      setSearchError("");
      setActiveSearchResultIndex(-1);
      changeViewMode("conferences");
      setConferenceTab("people");
      return;
    }

    if (!isRecordSearchResult(result)) {
      return;
    }

    setSearchResults([]);
    setSearchError("");
    setActiveSearchResultIndex(-1);
    const leadResult =
      result.type === "lead" ? leads.find((candidate) => candidate.id === result.id) : null;
    const targetView =
      leadResult && isNetworkProspectLead(leadResult) ? "network" : viewForEntityType(result.type);
    openRecordDetail({ entityType: result.type, id: result.id }, targetView);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (searchResults.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSearchResultIndex((current) => (current + 1) % searchResults.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSearchResultIndex(
        (current) => (current <= 0 ? searchResults.length : current) - 1
      );
      return;
    }

    if (event.key === "Enter" && activeSearchResultIndex >= 0) {
      event.preventDefault();
      openSearchResult(searchResults[activeSearchResultIndex]!);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setSearchResults([]);
      setSearchError("");
      setActiveSearchResultIndex(-1);
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
            className={viewMode === "network" ? "active" : ""}
            onClick={() => changeViewMode("network")}
          >
            <ClipboardCheck size={18} /> Network
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
            className={viewMode === "conferences" ? "active" : ""}
            onClick={() => changeViewMode("conferences")}
          >
            <CalendarDays size={18} /> Conferences
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
          <Metric icon={<ClipboardCheck size={18} />} label="Network" value={String(highPriorityNetworkLeads.length)} />
          <Metric icon={<Building2 size={18} />} label="Accounts" value={String(activeAccounts.length)} />
          <Metric icon={<CalendarDays size={18} />} label="Priority" value={String(highPriorityConferencePeople.length)} />
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
                  aria-activedescendant={
                    activeSearchResultIndex >= 0 && searchResults[activeSearchResultIndex]
                      ? searchResultId(searchResults[activeSearchResultIndex]!)
                      : undefined
                  }
                  aria-controls="global-search-results"
                  aria-expanded={searchResults.length > 0}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
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
            <SearchResultsPanel
              activeIndex={activeSearchResultIndex}
              error={searchError}
              loading={searchingRecords}
              query={query}
              results={searchResults}
              onActiveIndexChange={setActiveSearchResultIndex}
              onOpen={openSearchResult}
            />
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
                  leads={filteredSalesLeads}
                  message={leadMessage}
                  onConvert={convertLeadToOpportunity}
                  onOpenRecord={(lead) =>
                    openRecordDetail({ entityType: "lead", id: lead.id }, "leads")
                  }
                />
              </>
            ) : null}

            {viewMode === "network" ? (
              <NetworkProspectingView
                leads={filteredNetworkLeads}
                tasks={tasks}
                onOpenRecord={(lead) =>
                  openRecordDetail({ entityType: "lead", id: lead.id }, "network")
                }
              />
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

            {viewMode === "conferences" ? (
              <>
                {conferenceCreateOpen ? (
                  <ConferenceCreateForm
                    busy={conferenceBusy}
                    draft={conferenceCreateDraft}
                    onCancel={() => {
                      setConferenceCreateOpen(false);
                      setConferenceCreateDraft(emptyConferenceCreateDraft());
                    }}
                    onChange={setConferenceCreateDraft}
                    onSubmit={createConferenceFromToolbar}
                  />
                ) : null}
                <ConferencesView
                  accountsById={accountsById}
                  busy={conferenceBusy}
                  companyDraft={conferenceCompanyDraft}
                  companyImportPreview={conferenceCompanyImportPreview}
                  companyCsv={conferenceCompanyCsv}
                  companyCsvPlaceholder={conferenceCompanyCsvPlaceholder}
                  companies={selectedConferenceCompanies}
                  conferencePeopleById={conferencePeopleById}
                  conferences={conferences}
                  currentTab={conferenceTab}
                  dataPermissions={dataPermissions}
                  meetingCsv={conferenceMeetingCsv}
                  meetingCsvPlaceholder={conferenceMeetingCsvPlaceholder}
                  meetingDraft={conferenceMeetingDraft}
                  meetingImportPreview={conferenceMeetingImportPreview}
                  meetings={selectedConferenceMeetings}
                  message={conferenceMessage}
                  people={selectedConferencePeople}
                  personDraft={conferencePersonDraft}
                  personImportPreview={conferencePersonImportPreview}
                  personCsv={conferencePersonCsv}
                  personCsvPlaceholder={conferencePersonCsvPlaceholder}
                  selectedConference={selectedConference}
                  selectedConferenceId={selectedConference?.id ?? selectedConferenceId}
                  onCompanyCsvChange={setConferenceCompanyCsv}
                  onCompanyDraftChange={setConferenceCompanyDraft}
                  onCreateCompany={createConferenceCompanyFromForm}
                  onCreateMeeting={createConferenceMeetingFromForm}
                  onCreatePerson={createConferencePersonFromForm}
                  onCreateAccountFromCompany={createAccountFromConferenceCompany}
                  onCreateContactFromPerson={createContactFromConferencePerson}
                  onCreateTask={createConferenceFollowUpTask}
                  onBulkCreateTasks={createConferenceFollowUpTasks}
                  onBulkMarkOptOut={bulkMarkConferencePeopleOptedOut}
                  onBulkRequestMeetings={bulkRequestConferenceMeetings}
                  onBulkSetOutreachStatus={bulkSetConferenceOutreachStatus}
                  onImportCompanies={importConferenceCompaniesCsv}
                  onImportMeetings={importConferenceMeetingsCsv}
                  onImportPeople={importConferencePeopleCsv}
                  onMeetingDraftChange={setConferenceMeetingDraft}
                  onMeetingCsvChange={setConferenceMeetingCsv}
                  onPersonCsvChange={setConferencePersonCsv}
                  onPersonDraftChange={setConferencePersonDraft}
                  onPreviewCompanies={previewConferenceCompaniesCsv}
                  onPreviewMeetings={previewConferenceMeetingsCsv}
                  onPreviewPeople={previewConferencePeopleCsv}
                  onSelectConference={setSelectedConferenceId}
                  onTabChange={setConferenceTab}
                />
              </>
            ) : null}

            {viewMode === "data" ? (
              <DataView
                accountCsv={accountCsv}
                contactCsv={contactCsv}
                opportunityCsv={opportunityCsv}
                customFieldDefinitions={customFieldDefinitions}
                customFieldDraft={customFieldDraft}
                dataBusy={dataBusy}
                dataMessage={dataMessage}
                dataPermissions={dataPermissions}
                customFieldPermissions={customFieldPermissions}
                accountImportPreview={accountImportPreview}
                importPreview={importPreview}
                opportunityImportPreview={opportunityImportPreview}
                onAccountCsvChange={setAccountCsv}
                onContactCsvChange={setContactCsv}
                onOpportunityCsvChange={setOpportunityCsv}
                onCreateCustomField={createCustomFieldDefinition}
                onCustomFieldDraftChange={setCustomFieldDraft}
                onExport={exportRecords}
                onImportAccounts={importAccountCsv}
                onImport={importContactCsv}
                onImportOpportunities={importOpportunityCsv}
                onPreviewAccounts={previewAccountCsv}
                onPreview={previewContactCsv}
                onPreviewOpportunities={previewOpportunityCsv}
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
                customFieldPermissions={customFieldPermissions}
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
              conferencePeopleById={conferencePeopleById}
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
