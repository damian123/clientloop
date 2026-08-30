"use client";

import { Activity, Check, ClipboardCheck, Pencil, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  AppendNoteInput,
  CreateActivityInput,
  CreateTaskInput,
  DashboardResponse,
  UpdateActivityInput,
  UpdateNoteInput,
  UpdateTaskInput
} from "@clientloop/contracts";
import type {
  Account,
  Activity as CRMActivity,
  ConferencePerson,
  Contact,
  CustomFieldDefinition,
  Lead,
  Note,
  Opportunity,
  RecordEntityType,
  Task
} from "@clientloop/domain";
import type { CustomFieldPermissions, TimelinePermissions } from "../lib/session-permissions";
import type {
  ActivityEditDraft,
  ActivityPayloadDraft,
  CustomFieldRecord,
  CustomFieldValueDrafts,
  TaskDueFilter,
  TaskEditDraft,
  TaskOwnerFilter,
  TaskStatusFilter,
  TimelineFilter,
  TimelineItem
} from "./workspace-model";
import {
  activityPayloadDraftFromActivity,
  activityPayloadSummary,
  buildActivityPayload,
  dateInputValue,
  emptyActivityPayloadDraft,
  emptyTaskEditDraft,
  errorSummary,
  formatCurrency,
  formatDate,
  formatDateTime,
  recordLabel,
  taskEditDraftFromTask,
  taskMatchesDueFilter,
  taskTimelineDetail,
  timelineEmptyMessage,
  timelineFilterLabel
} from "./workspace-helpers";
import { stageLabels } from "./workspace-model";
import { CustomFieldValueEditor, DetailMetric, StatusPill } from "./workspace-ui";

export function RecordDetailPanel({
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
  customFieldPermissions,
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
  customFieldPermissions: CustomFieldPermissions;
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
          canUpdate={customFieldPermissions.canUpdateRecordValues(entityType, record)}
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

export function TaskQueue({
  tasks,
  opportunities,
  accountsById,
  contactsById,
  conferencePeopleById,
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
  conferencePeopleById: Map<string, ConferencePerson>;
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
          const parentConferencePerson =
            task.parent?.type === "conference_person"
              ? conferencePeopleById.get(task.parent.id)
              : undefined;
          const parentName =
            parentAccount?.name ??
            (parentContact ? `${parentContact.firstName} ${parentContact.lastName}` : undefined) ??
            parentLead?.contactName ??
            parentConferencePerson?.name ??
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

export function Timeline({
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

export function ActivityPayloadFields({
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
