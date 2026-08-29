# 0059 - Account First Conference Prospecting

## Goal

Add an account first conference prospecting workflow for advisory buyers. The CRM should help users identify relevant companies first, then score senior people at those companies, prioritize outreach, and track legitimate source, consent, opt out, meeting, and follow-up status.

## Status

- [x] Planned
- [x] In progress
- [x] Implemented
- [x] Verified

## Product Scope

The workflow should focus on likely buyers for strategy, capital formation, partnerships, execution, real world assets, private markets, fundraising, market entry, and operational transformation advisory work. It should not optimize for raw attendee collection, retail trading leads, or questionable attendee-list acquisition.

Use this operating path:

`Conference page -> company list -> senior person list -> attendance signal -> score -> meeting request`

## Buyer Profiles

Prioritize these people:

| Buyer type | Titles to look for | Fit reason |
| --- | --- | --- |
| Founders and operators | Founder, CEO, COO, CFO, Head of Strategy | Capital strategy, fundraising preparation, market entry, execution support |
| Asset owners | Principal, Managing Partner, Real Estate Director, Infrastructure Lead, Commodities Lead | RWA structuring, tokenization strategy, partner readiness, investor positioning |
| Private markets firms | GP, Partner, Head of IR, Capital Formation, Investor Relations, Portfolio Manager | Fundraising support, diligence materials, investor narrative, deal positioning |
| Fintech and digital asset firms | Head of Digital Assets, Tokenization, Product, Partnerships, Market Infrastructure | Go to market, partnerships, regulatory-aware positioning, launch readiness |
| Investors and allocators | CIO, Investment Director, Family Office Principal, Venture Partner | Client, referral source, or capital ecosystem contact |
| Strategic partners | Head of Partnerships, Business Development, Corporate Development | Distribution, market entry, or partner mapping |

Lower priority: junior attendees, students, media, generic service providers, pure retail crypto marketers, unrelated SaaS vendors, and direct advisory competitors.

## Data Model Tasks

- [x] Add a `Conference` model with name, dates, location, website, audience type, organizer contact, sponsor package link, app name, attendee access status, and source notes.
- [x] Add a `ConferenceCompany` model linked to `Conference`, optionally linked to an existing `Account`, with company website, conference role, sector, relevance flags, company score, and source URL.
- [x] Add a `ConferencePerson` model linked to `Conference` and optionally to `ConferenceCompany`, `Account`, and `Contact`, with name, title, LinkedIn, lawfully sourced email, conference signal, ICP category, buying signal, relationship path, outreach status, source, lawful basis notes, and opt out status.
- [x] Add score fields for `ConferencePerson`: seniority score 0 to 4, company fit score 0 to 4, signal score 0 to 5, conference signal score 0 to 3, warm intro score 0 to 2, timing score 0 to 2, total score 0 to 20, and priority band.
- [x] Add a `ConferenceMeeting` model linked to `ConferencePerson` with reason to meet, proposed ask, intro path, meeting requested status, meeting booked status, notes, and next step.
- [x] Add enums for source type, conference role, ICP category, outreach status, meeting status, attendee access status, and opt out status.
- [x] Add Prisma migration, generated client updates, and repository mapping helpers.

## Contracts And API Tasks

- [x] Add domain types and Zod schemas for conferences, conference companies, conference people, meetings, scoring inputs, and list filters.
- [x] Add REST endpoints for CRUD and list operations:
  - `GET/POST /v1/conferences`
  - `GET/PATCH /v1/conferences/:id`
  - `GET/POST /v1/conferences/:id/companies`
  - `GET/POST /v1/conferences/:id/people`
  - `PATCH /v1/conference-people/:id`
  - `POST /v1/conference-people/:id/score`
  - `GET/POST /v1/conferences/:id/meetings`
  - `PATCH /v1/conference-meetings/:id`
- [x] Add search support so conferences, conference companies, and high-priority conference people appear in global search.
- [x] Add permissions for reading, creating, updating, exporting, and managing conference prospecting data.
- [x] Add OpenAPI entries and UI SDK methods for all new endpoints.

## Scoring Tasks

- [x] Implement the 20 point scoring model as a domain function, with validation for each subscore range.
- [x] Derive priority bands:
  - 16 to 20: request meeting before the conference
  - 12 to 15: personalized outreach or warm intro
  - 8 to 11: add to nurture list
  - Below 8: do not prioritize
- [x] Allow manual score edits with explicit source and notes.
- [x] Store score history as an activity event or audit trail entry when a score changes.
- [x] Add filters by priority band, ICP category, company score, conference signal, outreach status, meeting status, source type, and opt out status.

## Import And Research Tasks

- [x] Add CSV preview and commit flows for conference companies, people, and meetings.
- [x] Provide CSV templates matching these minimum fields:
  - Conference: conference name, date, location, website, audience type, organizer contact, sponsor package link, app name, attendee access available, source notes.
  - Company: company, website, conference role, sector, RWA relevance, private markets relevance, fundraising relevance, market entry relevance, partnership relevance, company score, source URL.
  - People: name, title, company, LinkedIn, email if lawfully sourced, conference signal, seniority score, fit score, buying signal, relationship path, outreach status, source, consent or lawful basis notes, opt out status.
  - Meeting: name, company, reason to meet, proposed ask, intro path, meeting requested, meeting booked, notes, next step.
- [x] Add a saved search query helper for each conference with templates for tokenization, real world assets, RWA, private markets, capital formation, fundraising, market infrastructure, speakers, sponsors, exhibitors, public attending posts, and company-level signals.
- [x] Add an organizer email template panel.
- [x] Do not add scraping of private attendee apps, login-walled directories, or purchased attendee-list ingestion.

## Frontend Tasks

- [x] Add a `Conferences` view to the CRM navigation.
- [x] Add a conference selector with date, location, audience type, attendee access status, company count, people count, high-priority people count, and meeting count.
- [x] Add a conference detail workspace with tabs for Companies, People, Meetings, Search Queries, and Organizer Access.
- [x] Add inline create flows for conference, company, person, and meeting records.
- [x] Add score badges and priority band labels in the People tab.
- [x] Add bulk actions for setting outreach status, marking opt out, requesting meetings, and creating follow-up tasks.
- [x] Add follow-up task creation from conference people.
- [x] Ensure the UI keeps account-first ordering: companies are the primary list, people are linked to selected companies, and meetings are tied to prioritized people.

## Conversion Action Tasks

- [x] Create and link a CRM account from a conference company.
- [x] Create and link a CRM contact from a conference person.
- [x] Create the linked company account first when converting a person whose conference company is not yet an account.
- [x] Preserve existing task conversion through conference-person follow-up tasks.
- [ ] Convert a conference person into a lead when the person is interesting but not yet account/contact qualified.
- [ ] Create an opportunity from a prioritized conference person or meeting plan.
- [ ] Add note and activity conversion actions from conference research and meeting outcomes.

## Compliance And Guardrail Tasks

- [x] Require source type and source notes/source text for imported people.
- [x] Require lawful basis notes before storing or using an email address for outreach.
- [x] Track opt out status and block meeting-request or task outreach actions for opted-out people.
- [x] Keep public signal, official directory, warm intro, sponsor access, and manual research sources visibly distinct.
- [x] Add copy that discourages private attendee-app scraping, login-wall bypassing, and questionable attendee-list purchases.
- [x] Keep the module advisory-focused and avoid fields or defaults that imply brokerage, exchange, custody, investment advice, or retail trading lead generation.

## Testing Tasks

- [x] Add unit tests for score calculation, priority band derivation, lawful basis requirements, and opt out blocking.
- [x] Add API tests for conference create, company create, person create, meeting create, and opt out blocking.
- [x] Add import parser tests for valid templates, invalid score ranges, lawful basis validation, and opt out rows.
- [x] Add browser coverage for creating a conference, importing companies and people, scoring a person, filtering high-priority people, and creating a meeting task.
- [x] Add regression coverage that verifies opted-out people cannot be included in outreach actions.

## Implementation Tasks

Use these as separate implementation prompts if the work is split across sessions:

1. Implement the Prisma models, enums, migrations, domain types, and repository mappers for account first conference prospecting.
2. Implement contracts, OpenAPI, API routes, repository methods, permissions, and UI SDK methods for conferences, conference companies, conference people, scoring, and meetings.
3. Implement the domain scoring service, priority bands, score history activity/audit behavior, and tests.
4. Implement CSV preview and commit workflows for conference companies, people, and meetings, including source and lawful-basis validation.
5. Implement the web CRM `Conferences` view, detail tabs, create/edit flows, filters, score badges, and meeting workflow.
6. Implement conversion actions from conference records into existing accounts, contacts, leads, opportunities, tasks, notes, and activities.
7. Implement compliance guardrails, copy, opt out blocking, and browser regression tests.

## References

- UK ICO B2B marketing guidance: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/
- FTC CAN-SPAM guide: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
