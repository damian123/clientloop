"use client";

import {
  Building2,
  CalendarDays,
  Check,
  ClipboardCheck,
  Filter,
  Plus,
  Upload,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  ConferenceCompanyImportPreview,
  ConferenceMeetingImportPreview,
  ConferencePersonImportPreview
} from "@clientloop/contracts";
import type {
  Account,
  Conference,
  ConferenceCompany,
  ConferenceIcpCategory,
  ConferenceMeeting,
  ConferenceMeetingStatus,
  ConferenceOptOutStatus,
  ConferenceOutreachStatus,
  ConferencePerson,
  ConferencePriorityBand,
  ConferenceRole,
  ConferenceSourceType
} from "@clientloop/domain";
import type { DataPermissions } from "../lib/session-permissions";
import type {
  ConferenceCompanyDraft,
  ConferenceCompanyScoreFilter,
  ConferenceCreateDraft,
  ConferenceMeetingDraft,
  ConferencePersonDraft,
  ConferenceSignalFilter,
  ConferenceTab
} from "./workspace-model";
import {
  conferenceCompanyCsvPlaceholder,
  conferenceCompanyCsvTemplate,
  conferenceCsvTemplate,
  conferenceIcpCategories,
  conferenceMeetingCsvPlaceholder,
  conferenceMeetingCsvTemplate,
  conferenceMeetingStatuses,
  conferenceOptOutStatuses,
  conferenceOutreachStatuses,
  conferencePersonCsvPlaceholder,
  conferencePersonCsvTemplate,
  conferencePriorityBands,
  conferenceRoles,
  conferenceSourceTypes
} from "./workspace-model";
import {
  companyFitLabels,
  conferenceCreateInput,
  conferenceSearchQueries,
  domainFromUrl,
  formatDate,
  formatLabel,
  outreachStatusRequiresPermission,
  tabLabel
} from "./workspace-helpers";
import { ImportSection } from "./data-view";
import { RecordCreateActions, RecordCreatePanel } from "./record-views";
import { StatusPill } from "./workspace-ui";

export function ConferenceCreateForm({
  busy,
  draft,
  onCancel,
  onChange,
  onSubmit
}: {
  busy: boolean;
  draft: ConferenceCreateDraft;
  onCancel: () => void;
  onChange: (draft: ConferenceCreateDraft) => void;
  onSubmit: () => void;
}) {
  return (
    <RecordCreatePanel title="conference">
      <label>
        <span>Conference</span>
        <input
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder="Northwind Product Summit"
        />
      </label>
      <label>
        <span>Start</span>
        <input
          type="date"
          value={draft.startDate}
          onChange={(event) => onChange({ ...draft, startDate: event.target.value })}
        />
      </label>
      <label>
        <span>End</span>
        <input
          type="date"
          value={draft.endDate}
          onChange={(event) => onChange({ ...draft, endDate: event.target.value })}
        />
      </label>
      <label>
        <span>Location</span>
        <input
          value={draft.location}
          onChange={(event) => onChange({ ...draft, location: event.target.value })}
          placeholder="New York, NY"
        />
      </label>
      <label>
        <span>Website</span>
        <input
          value={draft.website}
          onChange={(event) => onChange({ ...draft, website: event.target.value })}
          placeholder="https://example.com"
        />
      </label>
      <label>
        <span>Audience</span>
        <input
          value={draft.audienceType}
          onChange={(event) => onChange({ ...draft, audienceType: event.target.value })}
          placeholder="Enterprise software and partnerships"
        />
      </label>
      <RecordCreateActions
        busy={busy}
        disabled={!conferenceCreateInput(draft)}
        label="Create conference"
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </RecordCreatePanel>
  );
}

export function ConferencesView({
  accountsById,
  busy,
  companyDraft,
  companyImportPreview,
  companyCsv,
  companyCsvPlaceholder,
  companies,
  conferencePeopleById,
  conferences,
  currentTab,
  dataPermissions,
  meetingCsv,
  meetingCsvPlaceholder,
  meetingDraft,
  meetingImportPreview,
  meetings,
  message,
  people,
  personDraft,
  personImportPreview,
  personCsv,
  personCsvPlaceholder,
  selectedConference,
  selectedConferenceId,
  onCompanyCsvChange,
  onCompanyDraftChange,
  onCreateAccountFromCompany,
  onCreateCompany,
  onCreateContactFromPerson,
  onCreateMeeting,
  onCreatePerson,
  onCreateTask,
  onBulkCreateTasks,
  onBulkMarkOptOut,
  onBulkRequestMeetings,
  onBulkSetOutreachStatus,
  onImportCompanies,
  onImportMeetings,
  onImportPeople,
  onMeetingCsvChange,
  onMeetingDraftChange,
  onPersonCsvChange,
  onPersonDraftChange,
  onPreviewCompanies,
  onPreviewMeetings,
  onPreviewPeople,
  onSelectConference,
  onTabChange
}: {
  accountsById: Map<string, Account>;
  busy: boolean;
  companyDraft: ConferenceCompanyDraft;
  companyImportPreview: ConferenceCompanyImportPreview | null;
  companyCsv: string;
  companyCsvPlaceholder: string;
  companies: ConferenceCompany[];
  conferencePeopleById: Map<string, ConferencePerson>;
  conferences: Conference[];
  currentTab: ConferenceTab;
  dataPermissions: DataPermissions;
  meetingCsv: string;
  meetingCsvPlaceholder: string;
  meetingDraft: ConferenceMeetingDraft;
  meetingImportPreview: ConferenceMeetingImportPreview | null;
  meetings: ConferenceMeeting[];
  message: string;
  people: ConferencePerson[];
  personDraft: ConferencePersonDraft;
  personImportPreview: ConferencePersonImportPreview | null;
  personCsv: string;
  personCsvPlaceholder: string;
  selectedConference: Conference | null;
  selectedConferenceId: string;
  onCompanyCsvChange: (value: string) => void;
  onCompanyDraftChange: (draft: ConferenceCompanyDraft) => void;
  onCreateAccountFromCompany: (company: ConferenceCompany) => void;
  onCreateCompany: () => void;
  onCreateContactFromPerson: (person: ConferencePerson) => void;
  onCreateMeeting: () => void;
  onCreatePerson: () => void;
  onCreateTask: (person: ConferencePerson) => void;
  onBulkCreateTasks: (people: ConferencePerson[]) => void;
  onBulkMarkOptOut: (people: ConferencePerson[]) => void;
  onBulkRequestMeetings: (people: ConferencePerson[]) => void;
  onBulkSetOutreachStatus: (
    people: ConferencePerson[],
    outreachStatus: ConferenceOutreachStatus
  ) => void;
  onImportCompanies: () => void;
  onImportMeetings: () => void;
  onImportPeople: () => void;
  onMeetingCsvChange: (value: string) => void;
  onMeetingDraftChange: (draft: ConferenceMeetingDraft) => void;
  onPersonCsvChange: (value: string) => void;
  onPersonDraftChange: (draft: ConferencePersonDraft) => void;
  onPreviewCompanies: () => void;
  onPreviewMeetings: () => void;
  onPreviewPeople: () => void;
  onSelectConference: (id: string) => void;
  onTabChange: (tab: ConferenceTab) => void;
}) {
  const selectedCompanyCount = companies.length;
  const selectedPriorityCount = people.filter((person) => person.priorityBand === "request_meeting").length;
  const selectedBookedCount = meetings.filter((meeting) => meeting.status === "booked").length;

  return (
    <>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Conferences</p>
          <h3>Account first prospecting</h3>
        </div>
        <select
          className="field-input compact-select"
          value={selectedConferenceId}
          onChange={(event) => onSelectConference(event.target.value)}
        >
          {conferences.map((conference) => (
            <option key={conference.id} value={conference.id}>
              {conference.name}
            </option>
          ))}
        </select>
      </div>

      {!selectedConference ? (
        <p className="data-message">Create a conference to start prospecting.</p>
      ) : (
        <div className="conference-workspace">
          <section className="data-section conference-summary" aria-label="Conference summary">
            <div>
              <p className="eyebrow">{formatDate(selectedConference.startDate)}</p>
              <h4>{selectedConference.name}</h4>
            </div>
            <div className="import-summary">
              <strong>{selectedCompanyCount}</strong>
              <span>companies</span>
              <strong>{people.length}</strong>
              <span>people</span>
              <strong>{selectedPriorityCount}</strong>
              <span>priority</span>
              <strong>{selectedBookedCount}</strong>
              <span>booked</span>
            </div>
            <p className="table-subtext">
              {[selectedConference.location, selectedConference.audienceType, selectedConference.attendeeAccessStatus]
                .filter(Boolean)
                .join(" / ")}
            </p>
          </section>

          <div className="segmented" aria-label="Conference tabs">
            {(["companies", "people", "meetings", "queries", "templates", "access"] as ConferenceTab[]).map((tab) => (
              <button
                className={currentTab === tab ? "selected" : ""}
                key={tab}
                onClick={() => onTabChange(tab)}
              >
                {tabLabel(tab)}
              </button>
            ))}
          </div>

          {currentTab === "companies" ? (
            <ConferenceCompaniesTab
              accountsById={accountsById}
              busy={busy}
              csv={companyCsv}
              csvPlaceholder={companyCsvPlaceholder}
              draft={companyDraft}
              preview={companyImportPreview}
              companies={companies}
              dataPermissions={dataPermissions}
              onCsvChange={onCompanyCsvChange}
              onCreateAccount={onCreateAccountFromCompany}
              onDraftChange={onCompanyDraftChange}
              onImport={onImportCompanies}
              onPreview={onPreviewCompanies}
              onSubmit={onCreateCompany}
            />
          ) : null}

          {currentTab === "people" ? (
            <ConferencePeopleTab
              busy={busy}
              companies={companies}
              csv={personCsv}
              csvPlaceholder={personCsvPlaceholder}
              dataPermissions={dataPermissions}
              draft={personDraft}
              people={people}
              preview={personImportPreview}
              onCreateContact={onCreateContactFromPerson}
              onCreateTask={onCreateTask}
              onBulkCreateTasks={onBulkCreateTasks}
              onBulkMarkOptOut={onBulkMarkOptOut}
              onBulkRequestMeetings={onBulkRequestMeetings}
              onBulkSetOutreachStatus={onBulkSetOutreachStatus}
              onCsvChange={onPersonCsvChange}
              onDraftChange={onPersonDraftChange}
              onImport={onImportPeople}
              onPreview={onPreviewPeople}
              onSubmit={onCreatePerson}
            />
          ) : null}

          {currentTab === "meetings" ? (
            <ConferenceMeetingsTab
              busy={busy}
              csv={meetingCsv}
              csvPlaceholder={meetingCsvPlaceholder}
              dataPermissions={dataPermissions}
              draft={meetingDraft}
              preview={meetingImportPreview}
              meetings={meetings}
              people={people}
              peopleById={conferencePeopleById}
              onCsvChange={onMeetingCsvChange}
              onDraftChange={onMeetingDraftChange}
              onImport={onImportMeetings}
              onPreview={onPreviewMeetings}
              onSubmit={onCreateMeeting}
            />
          ) : null}

          {currentTab === "queries" ? (
            <ConferenceQueriesTab conferenceName={selectedConference.name} />
          ) : null}

          {currentTab === "templates" ? (
            <ConferenceTemplatesTab />
          ) : null}

          {currentTab === "access" ? (
            <ConferenceAccessTab conference={selectedConference} />
          ) : null}
        </div>
      )}

      {message ? <p className="data-message">{message}</p> : null}
    </>
  );
}

export function ConferenceCompaniesTab({
  accountsById,
  busy,
  companies,
  csv,
  csvPlaceholder,
  dataPermissions,
  draft,
  preview,
  onCsvChange,
  onCreateAccount,
  onDraftChange,
  onImport,
  onPreview,
  onSubmit
}: {
  accountsById: Map<string, Account>;
  busy: boolean;
  companies: ConferenceCompany[];
  csv: string;
  csvPlaceholder: string;
  dataPermissions: DataPermissions;
  draft: ConferenceCompanyDraft;
  preview: ConferenceCompanyImportPreview | null;
  onCsvChange: (value: string) => void;
  onCreateAccount: (company: ConferenceCompany) => void;
  onDraftChange: (draft: ConferenceCompanyDraft) => void;
  onImport: () => void;
  onPreview: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <section className="data-section" aria-label="Add conference company">
        <div>
          <p className="eyebrow">Company first</p>
          <h4>Add account prospect</h4>
        </div>
        <div className="field-form conference-form-grid">
          <label>
            <span>Company</span>
            <input
              value={draft.company}
              onChange={(event) => onDraftChange({ ...draft, company: event.target.value })}
              placeholder="Harbor Finance"
            />
          </label>
          <label>
            <span>Role</span>
            <select
              value={draft.conferenceRole}
              onChange={(event) =>
                onDraftChange({ ...draft, conferenceRole: event.target.value as ConferenceRole })
              }
            >
              {conferenceRoles.map((role) => (
                <option key={role} value={role}>
                  {formatLabel(role)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Sector</span>
            <input
              value={draft.sector}
              onChange={(event) => onDraftChange({ ...draft, sector: event.target.value })}
              placeholder="Private markets"
            />
          </label>
          <label>
            <span>Score</span>
            <input
              inputMode="numeric"
              value={draft.companyScore}
              onChange={(event) => onDraftChange({ ...draft, companyScore: event.target.value })}
              placeholder="17"
            />
          </label>
          <label>
            <span>Website</span>
            <input
              value={draft.website}
              onChange={(event) => onDraftChange({ ...draft, website: event.target.value })}
              placeholder="https://example.com"
            />
          </label>
          <label>
            <span>Source URL</span>
            <input
              value={draft.sourceUrl}
              onChange={(event) => onDraftChange({ ...draft, sourceUrl: event.target.value })}
              placeholder="https://example.com/sponsors"
            />
          </label>
          {[
            ["productFit", "Product"] as const,
            ["expansionFit", "Expansion"] as const,
            ["budgetFit", "Budget"] as const,
            ["marketEntryRelevance", "Market entry"] as const,
            ["partnershipRelevance", "Partnership"] as const
          ].map(([field, label]) => (
            <label className="check-field" key={field}>
              <input
                checked={draft[field]}
                onChange={(event) => onDraftChange({ ...draft, [field]: event.target.checked })}
                type="checkbox"
              />
              <span>{label}</span>
            </label>
          ))}
          <button className="primary-action" disabled={busy || !draft.company.trim()} onClick={onSubmit}>
            <Plus size={16} /> Add company
          </button>
        </div>
      </section>

      <ImportSection
        title="Conference company CSV"
        label="Conference company CSV"
        value={csv}
        placeholder={csvPlaceholder}
        busy={busy}
        allowed={dataPermissions.canImportConferences}
        preview={preview}
        onChange={onCsvChange}
        onPreview={onPreview}
        onImport={onImport}
      />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Company</th>
              <th scope="col">Role</th>
              <th scope="col">Sector</th>
              <th scope="col">Fit</th>
              <th scope="col">Score</th>
              <th scope="col">Linked account</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id}>
                <td>
                  <strong>{company.company}</strong>
                  <p className="table-subtext">{company.sourceUrl ?? company.website ?? ""}</p>
                </td>
                <td><StatusPill value={company.conferenceRole} /></td>
                <td>{company.sector ?? ""}</td>
                <td>{companyFitLabels(company).join(", ")}</td>
                <td>{company.companyScore}</td>
                <td>{company.accountId ? accountsById.get(company.accountId)?.name ?? "" : ""}</td>
                <td>
                  <button
                    className="table-action"
                    disabled={busy || Boolean(company.accountId)}
                    onClick={() => onCreateAccount(company)}
                  >
                    <Building2 size={16} /> Account
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ConferencePeopleTab({
  busy,
  companies,
  csv,
  csvPlaceholder,
  dataPermissions,
  draft,
  people,
  preview,
  onBulkCreateTasks,
  onBulkMarkOptOut,
  onBulkRequestMeetings,
  onBulkSetOutreachStatus,
  onCreateContact,
  onCreateTask,
  onCsvChange,
  onDraftChange,
  onImport,
  onPreview,
  onSubmit
}: {
  busy: boolean;
  companies: ConferenceCompany[];
  csv: string;
  csvPlaceholder: string;
  dataPermissions: DataPermissions;
  draft: ConferencePersonDraft;
  people: ConferencePerson[];
  preview: ConferencePersonImportPreview | null;
  onBulkCreateTasks: (people: ConferencePerson[]) => void;
  onBulkMarkOptOut: (people: ConferencePerson[]) => void;
  onBulkRequestMeetings: (people: ConferencePerson[]) => void;
  onBulkSetOutreachStatus: (
    people: ConferencePerson[],
    outreachStatus: ConferenceOutreachStatus
  ) => void;
  onCreateContact: (person: ConferencePerson) => void;
  onCreateTask: (person: ConferencePerson) => void;
  onCsvChange: (value: string) => void;
  onDraftChange: (draft: ConferencePersonDraft) => void;
  onImport: () => void;
  onPreview: () => void;
  onSubmit: () => void;
}) {
  const [priorityFilter, setPriorityFilter] = useState<ConferencePriorityBand | "all">("all");
  const [icpFilter, setIcpFilter] = useState<ConferenceIcpCategory | "all">("all");
  const [companyScoreFilter, setCompanyScoreFilter] =
    useState<ConferenceCompanyScoreFilter>("all");
  const [signalFilter, setSignalFilter] = useState<ConferenceSignalFilter>("all");
  const [outreachFilter, setOutreachFilter] = useState<ConferenceOutreachStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<ConferenceSourceType | "all">("all");
  const [optOutFilter, setOptOutFilter] = useState<ConferenceOptOutStatus | "all">("all");
  const [bulkOutreachStatus, setBulkOutreachStatus] =
    useState<ConferenceOutreachStatus>("queued");
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const selectedPersonIdSet = useMemo(() => new Set(selectedPersonIds), [selectedPersonIds]);
  const companiesById = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies]
  );
  const filteredPeople = useMemo(
    () =>
      people.filter((person) => {
        if (priorityFilter !== "all" && person.priorityBand !== priorityFilter) {
          return false;
        }
        if (icpFilter !== "all" && person.icpCategory !== icpFilter) {
          return false;
        }
        if (outreachFilter !== "all" && person.outreachStatus !== outreachFilter) {
          return false;
        }
        if (sourceFilter !== "all" && person.sourceType !== sourceFilter) {
          return false;
        }
        if (optOutFilter !== "all" && person.optOutStatus !== optOutFilter) {
          return false;
        }
        if (companyScoreFilter !== "all") {
          const companyScore = person.conferenceCompanyId
            ? companiesById.get(person.conferenceCompanyId)?.companyScore ?? -1
            : -1;
          if (companyScore < Number(companyScoreFilter)) {
            return false;
          }
        }
        if (
          signalFilter === "has_signal" &&
          !person.conferenceSignal &&
          !person.buyingSignal
        ) {
          return false;
        }
        if (signalFilter === "strong_signal" && person.conferenceSignalScore < 2) {
          return false;
        }
        return true;
      }),
    [
      companiesById,
      companyScoreFilter,
      icpFilter,
      optOutFilter,
      outreachFilter,
      people,
      priorityFilter,
      signalFilter,
      sourceFilter
    ]
  );
  const selectedPeople = useMemo(
    () => people.filter((person) => selectedPersonIdSet.has(person.id)),
    [people, selectedPersonIdSet]
  );
  const allVisibleSelected =
    filteredPeople.length > 0 && filteredPeople.every((person) => selectedPersonIdSet.has(person.id));

  useEffect(() => {
    setSelectedPersonIds((current) => {
      const visibleIds = new Set(filteredPeople.map((person) => person.id));
      const next = current.filter((id) => visibleIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [filteredPeople]);

  function togglePersonSelection(id: string) {
    setSelectedPersonIds((current) =>
      current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : [...current, id]
    );
  }

  function toggleAllVisiblePeople() {
    const visibleIds = filteredPeople.map((person) => person.id);
    setSelectedPersonIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }
      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  return (
    <>
      <section className="data-section" aria-label="Add conference person">
        <div>
          <p className="eyebrow">Senior people</p>
          <h4>Add buyer or partner</h4>
        </div>
        <div className="field-form conference-form-grid">
          <label>
            <span>Name</span>
            <input value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} />
          </label>
          <label>
            <span>Title</span>
            <input value={draft.title} onChange={(event) => onDraftChange({ ...draft, title: event.target.value })} />
          </label>
          <label>
            <span>Company</span>
            <select
              value={draft.conferenceCompanyId}
              onChange={(event) => onDraftChange({ ...draft, conferenceCompanyId: event.target.value })}
            >
              <option value="">No linked company</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.company}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>ICP</span>
            <select
              value={draft.icpCategory}
              onChange={(event) =>
                onDraftChange({ ...draft, icpCategory: event.target.value as ConferenceIcpCategory })
              }
            >
              {conferenceIcpCategories.map((category) => (
                <option key={category} value={category}>
                  {formatLabel(category)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>LinkedIn</span>
            <input
              value={draft.linkedIn}
              onChange={(event) => onDraftChange({ ...draft, linkedIn: event.target.value })}
              placeholder="https://linkedin.com/in/..."
            />
          </label>
          <label>
            <span>Email</span>
            <input
              value={draft.email}
              onChange={(event) => onDraftChange({ ...draft, email: event.target.value })}
              placeholder="Only if lawfully sourced"
            />
          </label>
          <label>
            <span>Source type</span>
            <select
              value={draft.sourceType}
              onChange={(event) =>
                onDraftChange({ ...draft, sourceType: event.target.value as ConferenceSourceType })
              }
            >
              {conferenceSourceTypes.map((sourceType) => (
                <option key={sourceType} value={sourceType}>
                  {formatLabel(sourceType)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Opt out</span>
            <select
              value={draft.optOutStatus}
              onChange={(event) =>
                onDraftChange({ ...draft, optOutStatus: event.target.value as ConferenceOptOutStatus })
              }
            >
              <option value="unknown">Unknown</option>
              <option value="not_opted_out">Not opted out</option>
              <option value="opted_out">Opted out</option>
            </select>
          </label>
          <label className="field-options">
            <span>Signal</span>
            <input
              value={draft.conferenceSignal}
              onChange={(event) => onDraftChange({ ...draft, conferenceSignal: event.target.value })}
              placeholder="Speaker on platform integrations panel"
            />
          </label>
          <label className="field-options">
            <span>Buying signal</span>
            <input
              value={draft.buyingSignal}
              onChange={(event) => onDraftChange({ ...draft, buyingSignal: event.target.value })}
              placeholder="Expansion, new market, partnership"
            />
          </label>
          <label className="field-options">
            <span>Lawful basis notes</span>
            <input
              value={draft.lawfulBasisNotes}
              onChange={(event) => onDraftChange({ ...draft, lawfulBasisNotes: event.target.value })}
              placeholder="Required before storing email"
            />
          </label>
          <div className="score-grid">
            {[
              ["seniorityScore", "Seniority"] as const,
              ["companyFitScore", "Company fit"] as const,
              ["signalScore", "Signal"] as const,
              ["conferenceSignalScore", "Conference"] as const,
              ["warmIntroScore", "Intro"] as const,
              ["timingScore", "Timing"] as const
            ].map(([field, label]) => (
              <label key={field}>
                <span>{label}</span>
                <input
                  inputMode="numeric"
                  value={draft[field]}
                  onChange={(event) => onDraftChange({ ...draft, [field]: event.target.value })}
                />
              </label>
            ))}
          </div>
          <button className="primary-action" disabled={busy || !draft.name.trim() || !draft.title.trim()} onClick={onSubmit}>
            <Plus size={16} /> Add person
          </button>
        </div>
      </section>

      <ImportSection
        title="Conference people CSV"
        label="Conference people CSV"
        value={csv}
        placeholder={csvPlaceholder}
        busy={busy}
        allowed={dataPermissions.canImportConferences}
        preview={preview}
        onChange={onCsvChange}
        onPreview={onPreview}
        onImport={onImport}
      />

      <section className="data-section conference-filter-panel" aria-label="Conference people filters">
        <div>
          <p className="eyebrow">Prioritize</p>
          <h4>Filter senior attendees</h4>
        </div>
        <div className="conference-filter-grid">
          <label>
            <span>Priority</span>
            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value as ConferencePriorityBand | "all")
              }
            >
              <option value="all">All priorities</option>
              {conferencePriorityBands.map((priority) => (
                <option key={priority} value={priority}>
                  {formatLabel(priority)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>ICP</span>
            <select
              value={icpFilter}
              onChange={(event) =>
                setIcpFilter(event.target.value as ConferenceIcpCategory | "all")
              }
            >
              <option value="all">All ICP categories</option>
              {conferenceIcpCategories.map((category) => (
                <option key={category} value={category}>
                  {formatLabel(category)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Company score</span>
            <select
              value={companyScoreFilter}
              onChange={(event) =>
                setCompanyScoreFilter(event.target.value as ConferenceCompanyScoreFilter)
              }
            >
              <option value="all">All company scores</option>
              <option value="16">16+</option>
              <option value="12">12+</option>
              <option value="8">8+</option>
            </select>
          </label>
          <label>
            <span>Conference signal</span>
            <select
              value={signalFilter}
              onChange={(event) => setSignalFilter(event.target.value as ConferenceSignalFilter)}
            >
              <option value="all">All signals</option>
              <option value="has_signal">Has signal</option>
              <option value="strong_signal">Strong signal score</option>
            </select>
          </label>
          <label>
            <span>Outreach</span>
            <select
              value={outreachFilter}
              onChange={(event) =>
                setOutreachFilter(event.target.value as ConferenceOutreachStatus | "all")
              }
            >
              <option value="all">All outreach statuses</option>
              {conferenceOutreachStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Source type</span>
            <select
              value={sourceFilter}
              onChange={(event) =>
                setSourceFilter(event.target.value as ConferenceSourceType | "all")
              }
            >
              <option value="all">All source types</option>
              {conferenceSourceTypes.map((sourceType) => (
                <option key={sourceType} value={sourceType}>
                  {formatLabel(sourceType)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Opt out</span>
            <select
              value={optOutFilter}
              onChange={(event) =>
                setOptOutFilter(event.target.value as ConferenceOptOutStatus | "all")
              }
            >
              <option value="all">All opt-out statuses</option>
              {conferenceOptOutStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="conference-bulk-bar">
          <p className="task-filter-summary">
            Showing {filteredPeople.length} of {people.length} people / {selectedPeople.length} selected
          </p>
          <div className="data-actions">
            <label className="bulk-select-field">
              <span>Set outreach</span>
              <select
                value={bulkOutreachStatus}
                onChange={(event) =>
                  setBulkOutreachStatus(event.target.value as ConferenceOutreachStatus)
                }
              >
                {conferenceOutreachStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={busy || selectedPeople.length === 0}
              onClick={() => onBulkSetOutreachStatus(selectedPeople, bulkOutreachStatus)}
            >
              <Check size={16} /> Apply
            </button>
            <button
              disabled={busy || selectedPeople.length === 0}
              onClick={() => onBulkRequestMeetings(selectedPeople)}
            >
              <CalendarDays size={16} /> Request
            </button>
            <button
              disabled={busy || selectedPeople.length === 0}
              onClick={() => onBulkCreateTasks(selectedPeople)}
            >
              <ClipboardCheck size={16} /> Tasks
            </button>
            <button
              disabled={busy || selectedPeople.length === 0}
              onClick={() => onBulkMarkOptOut(selectedPeople)}
            >
              <X size={16} /> Opt out
            </button>
          </div>
        </div>
      </section>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Select</span>
                <input
                  aria-label="Select all visible conference people"
                  checked={allVisibleSelected}
                  disabled={filteredPeople.length === 0}
                  onChange={toggleAllVisiblePeople}
                  type="checkbox"
                />
              </th>
              <th scope="col">Person</th>
              <th scope="col">ICP</th>
              <th scope="col">Signal</th>
              <th scope="col">Score</th>
              <th scope="col">Priority</th>
              <th scope="col">Source</th>
              <th scope="col">Outreach</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredPeople.length === 0 ? (
              <tr>
                <td colSpan={9}>No people match these filters.</td>
              </tr>
            ) : null}
            {filteredPeople.map((person) => (
              <tr key={person.id}>
                <td>
                  <input
                    aria-label={`Select ${person.name}`}
                    checked={selectedPersonIdSet.has(person.id)}
                    onChange={() => togglePersonSelection(person.id)}
                    type="checkbox"
                  />
                </td>
                <td>
                  <strong>{person.name}</strong>
                  <p className="table-subtext">{person.title}</p>
                </td>
                <td><StatusPill value={person.icpCategory} /></td>
                <td>{person.buyingSignal || person.conferenceSignal || ""}</td>
                <td>{person.totalScore}/20</td>
                <td><StatusPill value={person.priorityBand} /></td>
                <td><StatusPill value={person.sourceType} /></td>
                <td>
                  <StatusPill value={person.optOutStatus === "opted_out" ? "opted_out" : person.outreachStatus} />
                </td>
                <td>
                  <div className="table-action-group">
                    <button
                      className="table-action"
                      disabled={busy || person.optOutStatus === "opted_out"}
                      onClick={() => onCreateTask(person)}
                    >
                      <ClipboardCheck size={16} /> Task
                    </button>
                    <button
                      className="table-action"
                      disabled={busy || Boolean(person.contactId)}
                      onClick={() => onCreateContact(person)}
                    >
                      <UserRound size={16} /> Contact
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ConferenceMeetingsTab({
  busy,
  csv,
  csvPlaceholder,
  dataPermissions,
  draft,
  meetings,
  people,
  peopleById,
  preview,
  onCsvChange,
  onDraftChange,
  onImport,
  onPreview,
  onSubmit
}: {
  busy: boolean;
  csv: string;
  csvPlaceholder: string;
  dataPermissions: DataPermissions;
  draft: ConferenceMeetingDraft;
  meetings: ConferenceMeeting[];
  people: ConferencePerson[];
  peopleById: Map<string, ConferencePerson>;
  preview: ConferenceMeetingImportPreview | null;
  onCsvChange: (value: string) => void;
  onDraftChange: (draft: ConferenceMeetingDraft) => void;
  onImport: () => void;
  onPreview: () => void;
  onSubmit: () => void;
}) {
  const [meetingStatusFilter, setMeetingStatusFilter] =
    useState<ConferenceMeetingStatus | "all">("all");
  const filteredMeetings = useMemo(
    () =>
      meetingStatusFilter === "all"
        ? meetings
        : meetings.filter((meeting) => meeting.status === meetingStatusFilter),
    [meetingStatusFilter, meetings]
  );

  return (
    <>
      <section className="data-section" aria-label="Add conference meeting">
        <div>
          <p className="eyebrow">Meetings</p>
          <h4>Plan targeted asks</h4>
        </div>
        <div className="field-form conference-form-grid">
          <label>
            <span>Person</span>
            <select
              value={draft.conferencePersonId}
              onChange={(event) => onDraftChange({ ...draft, conferencePersonId: event.target.value })}
            >
              <option value="">Select person</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              value={draft.status}
              onChange={(event) =>
                onDraftChange({ ...draft, status: event.target.value as ConferenceMeetingStatus })
              }
            >
              {conferenceMeetingStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="field-options">
            <span>Reason</span>
            <input
              value={draft.reasonToMeet}
              onChange={(event) => onDraftChange({ ...draft, reasonToMeet: event.target.value })}
              placeholder="Compare notes on a possible product partnership"
            />
          </label>
          <label className="field-options">
            <span>Proposed ask</span>
            <input
              value={draft.proposedAsk}
              onChange={(event) => onDraftChange({ ...draft, proposedAsk: event.target.value })}
              placeholder="15-minute meeting on day 1"
            />
          </label>
          <label>
            <span>Intro path</span>
            <input
              value={draft.introPath}
              onChange={(event) => onDraftChange({ ...draft, introPath: event.target.value })}
              placeholder="Warm intro"
            />
          </label>
          <label>
            <span>Next step</span>
            <input
              value={draft.nextStep}
              onChange={(event) => onDraftChange({ ...draft, nextStep: event.target.value })}
              placeholder="Request intro"
            />
          </label>
          <button
            className="primary-action"
            disabled={busy || !draft.conferencePersonId || !draft.reasonToMeet.trim()}
            onClick={onSubmit}
          >
            <Plus size={16} /> Add meeting
          </button>
        </div>
      </section>

      <ImportSection
        title="Conference meeting CSV"
        label="Conference meeting CSV"
        value={csv}
        placeholder={csvPlaceholder}
        busy={busy}
        allowed={dataPermissions.canImportConferences}
        preview={preview}
        onChange={onCsvChange}
        onPreview={onPreview}
        onImport={onImport}
      />

      <section className="data-section conference-filter-panel" aria-label="Conference meeting filters">
        <div>
          <p className="eyebrow">Meeting pipeline</p>
          <h4>Filter meeting status</h4>
        </div>
        <div className="conference-filter-grid compact">
          <label>
            <span>Meeting status</span>
            <select
              value={meetingStatusFilter}
              onChange={(event) =>
                setMeetingStatusFilter(event.target.value as ConferenceMeetingStatus | "all")
              }
            >
              <option value="all">All meeting statuses</option>
              {conferenceMeetingStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="task-filter-summary">
          Showing {filteredMeetings.length} of {meetings.length} meetings
        </p>
      </section>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Reason</th>
              <th scope="col">Ask</th>
              <th scope="col">Status</th>
              <th scope="col">Next</th>
            </tr>
          </thead>
          <tbody>
            {filteredMeetings.length === 0 ? (
              <tr>
                <td colSpan={5}>No meetings match this filter.</td>
              </tr>
            ) : null}
            {filteredMeetings.map((meeting) => {
              const person = peopleById.get(meeting.conferencePersonId);
              return (
                <tr key={meeting.id}>
                  <td>{person?.name ?? "Unknown"}</td>
                  <td>{meeting.reasonToMeet}</td>
                  <td>{meeting.proposedAsk ?? ""}</td>
                  <td><StatusPill value={meeting.status} /></td>
                  <td>{meeting.nextStep ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ConferenceQueriesTab({ conferenceName }: { conferenceName: string }) {
  const queries = conferenceSearchQueries(conferenceName);

  return (
    <section className="data-section" aria-label="Conference search queries">
      <div>
        <p className="eyebrow">Research</p>
        <h4>Saved search prompts</h4>
      </div>
      <div className="query-list">
        {queries.map((query) => (
          <code key={query}>{query}</code>
        ))}
      </div>
    </section>
  );
}

export function ConferenceTemplatesTab() {
  const templates = [
    ["Conference", conferenceCsvTemplate],
    ["Company", conferenceCompanyCsvTemplate],
    ["People", conferencePersonCsvTemplate],
    ["Meeting", conferenceMeetingCsvTemplate]
  ] as const;

  return (
    <section className="data-section" aria-label="Conference CSV templates">
      <div>
        <p className="eyebrow">Templates</p>
        <h4>CSV starting points</h4>
      </div>
      <div className="template-grid">
        {templates.map(([label, value]) => (
          <label key={label}>
            <span>{label}</span>
            <textarea className="template-box" readOnly value={value} />
          </label>
        ))}
      </div>
    </section>
  );
}

export function ConferenceAccessTab({ conference }: { conference: Conference }) {
  const organizerName = conference.organizerContact || "Name";
  const template = [
    `Subject: Attendee and networking access for ${conference.name}`,
    "",
    `Hi ${organizerName},`,
    "",
    `I'm evaluating whether ${conference.name} is a good fit for our conference outreach.`,
    "",
    "Could you confirm what attendee access is available to registered participants or sponsors?",
    "",
    "Specifically, I'd like to understand:",
    "1. Whether there is an opt in attendee directory or networking app",
    "2. Whether sponsors receive access to attendee names, company names, titles, or meeting requests",
    "3. Whether lead retrieval is available through badge scanning",
    "4. Whether attendee contact details are shared, and on what consent basis",
    "5. Whether exports are permitted or access is limited to the event platform",
    "",
    "Our team sells B2B software to operations and partnership leads, so we are looking to identify relevant attendees and request meetings through official event channels.",
    "",
    "Best,"
  ].join("\n");

  return (
    <section className="data-section" aria-label="Organizer access request">
      <div>
        <p className="eyebrow">Legitimate access</p>
        <h4>Organizer email</h4>
      </div>
      <textarea className="template-box" readOnly value={template} />
      <p className="table-subtext">
        Avoid private attendee-app scraping, login-wall bypassing, and questionable attendee-list purchases.
      </p>
    </section>
  );
}
