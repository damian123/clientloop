const jobs = [
  "overdue-task-reminders",
  "webhook-retry-backoff",
  "audit-retention-check",
  "search-index-refresh"
];

for (const job of jobs) {
  console.log(`scheduler registered job=${job}`);
}
