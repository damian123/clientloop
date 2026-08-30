"use client";

import { Filter } from "lucide-react";
import { useMemo, useState } from "react";
import type { Lead, Task } from "@clientloop/domain";
import { leadCustomFieldString, uniqueSorted } from "./workspace-helpers";

export function NetworkProspectingView({
  leads,
  tasks,
  onOpenRecord
}: {
  leads: Lead[];
  tasks: Task[];
  onOpenRecord: (lead: Lead) => void;
}) {
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [reviewStatusFilter, setReviewStatusFilter] = useState("all");
  const priorityOptions = useMemo(
    () => uniqueSorted(leads.map((lead) => leadCustomFieldString(lead, "network_priority"))),
    [leads]
  );
  const reviewStatusOptions = useMemo(
    () => uniqueSorted(leads.map((lead) => leadCustomFieldString(lead, "network_review_status"))),
    [leads]
  );
  const visibleLeads = useMemo(
    () =>
      leads.filter((lead) => {
        const priority = leadCustomFieldString(lead, "network_priority");
        const reviewStatus = leadCustomFieldString(lead, "network_review_status");
        const matchesPriority = priorityFilter === "all" || priority === priorityFilter;
        const matchesReview =
          reviewStatusFilter === "all" || reviewStatus === reviewStatusFilter;
        return matchesPriority && matchesReview;
      }),
    [leads, priorityFilter, reviewStatusFilter]
  );
  const leadIds = useMemo(() => new Set(leads.map((lead) => lead.id)), [leads]);
  const followUpTasks = tasks.filter(
    (task) => task.parent?.type === "lead" && leadIds.has(task.parent.id)
  );
  const pendingInvites = leads.filter(
    (lead) => leadCustomFieldString(lead, "network_outcome") === "Pending"
  );
  const readyToReview = leads.filter((lead) =>
    ["Ready to review", "Approved", "Needs profile verification"].includes(
      leadCustomFieldString(lead, "network_review_status")
    )
  );
  const blocked = leads.filter((lead) =>
    leadCustomFieldString(lead, "network_review_status").match(/blocked|not sent/i)
  );

  return (
    <div className="network-workspace">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Network prospecting</p>
          <h3>Client network expansion</h3>
        </div>
        <div className="segmented" aria-label="Network priority filter">
          <button
            className={priorityFilter === "all" ? "selected" : ""}
            onClick={() => setPriorityFilter("all")}
          >
            <Filter size={15} /> All
          </button>
          {priorityOptions.map((priority) => (
            <button
              key={priority}
              className={priorityFilter === priority ? "selected" : ""}
              onClick={() => setPriorityFilter(priority)}
            >
              {priority}
            </button>
          ))}
        </div>
      </div>

      <div className="network-summary" aria-label="Network prospecting summary">
        <div className="detail-metric">
          <span>Prospects</span>
          <strong>{leads.length}</strong>
        </div>
        <div className="detail-metric">
          <span>Pending invites</span>
          <strong>{pendingInvites.length}</strong>
        </div>
        <div className="detail-metric">
          <span>Ready to review</span>
          <strong>{readyToReview.length}</strong>
        </div>
        <div className="detail-metric">
          <span>Follow-ups</span>
          <strong>{followUpTasks.length}</strong>
        </div>
        <div className="detail-metric">
          <span>Blocked or skipped</span>
          <strong>{blocked.length}</strong>
        </div>
      </div>

      <section className="data-section conference-filter-panel" aria-label="Network queue filters">
        <div className="conference-filter-grid compact">
          <label>
            <span>Review status</span>
            <select
              value={reviewStatusFilter}
              onChange={(event) => setReviewStatusFilter(event.target.value)}
            >
              <option value="all">All review statuses</option>
              {reviewStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <div className="detail-metric">
            <span>Showing</span>
            <strong>
              {visibleLeads.length} of {leads.length}
            </strong>
          </div>
        </div>
      </section>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Prospect</th>
              <th scope="col">Priority</th>
              <th scope="col">Review</th>
              <th scope="col">Outcome</th>
              <th scope="col">Follow-up</th>
              <th scope="col">Suggested note</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleLeads.map((lead) => {
              const profileUrl = leadCustomFieldString(lead, "network_profile_url");
              const note = leadCustomFieldString(lead, "network_suggested_note");
              return (
                <tr key={lead.id}>
                  <td>
                    <button className="link-button" onClick={() => onOpenRecord(lead)}>
                      {lead.contactName}
                    </button>
                    <p className="table-subtext">{lead.companyName ?? ""}</p>
                    {profileUrl ? <p className="table-subtext">{profileUrl}</p> : null}
                  </td>
                  <td>
                    <strong>{leadCustomFieldString(lead, "network_priority") || "Unranked"}</strong>
                    <p className="table-subtext">
                      {leadCustomFieldString(lead, "network_region")}
                    </p>
                  </td>
                  <td>{leadCustomFieldString(lead, "network_review_status")}</td>
                  <td>{leadCustomFieldString(lead, "network_outcome")}</td>
                  <td>{leadCustomFieldString(lead, "network_follow_up_date")}</td>
                  <td>
                    <p className="network-note">{note}</p>
                  </td>
                  <td>
                    <button className="table-action" onClick={() => onOpenRecord(lead)}>
                      Open
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visibleLeads.length === 0 ? <div className="empty-state">No network prospects match the filters.</div> : null}
    </div>
  );
}
