# 0059 - Account-first conference prospecting

## Goal

Add an account-first conference prospecting workflow for B2B SaaS sales. The CRM should help users identify relevant companies first, then score senior people at those companies, prioritize outreach, and track source, consent, opt-out, meeting, and follow-up status.

## Status

- [x] Planned
- [x] In progress
- [x] Implemented
- [x] Verified

## Product scope

Focus on likely buyers for a generic B2B product: executives, economic buyers, operators, technical evaluators, champions, and partners. Do not optimize for raw attendee collection or questionable attendee-list acquisition.

Operating path:

`Conference page -> company list -> senior person list -> attendance signal -> score -> meeting request`

## Buyer profiles

| Buyer type | Titles to look for | Fit reason |
| --- | --- | --- |
| Executive | Founder, CEO, COO, CFO | Budget owner or strategic sponsor |
| Economic buyer | VP, Managing Director, Head of Operations | Owns the purchase decision |
| Operator | Director, Head of, GM | Runs the workflow the product would change |
| Technical evaluator | CTO, VP Engineering, Architect, IT | Assesses integration and security fit |
| Champion | Product, Partnerships, Business Development | Internal advocate |
| Partner | Head of Partnerships, Corporate Development | Distribution or co-sell path |

Lower priority: junior attendees, students, media, and unrelated vendors.

## Data model

- [x] `Conference` with name, dates, location, website, audience, organizer contact, and attendee-access status.
- [x] `ConferenceCompany` linked to `Conference` and optionally an `Account`, with sector, fit flags, company score, and source URL.
- [x] `ConferencePerson` linked to company/account/contact, with title, optional LinkedIn, lawfully sourced email, scores, outreach status, and opt-out.
- [x] Score fields: seniority 0–4, company fit 0–4, signal 0–5, conference signal 0–3, warm intro 0–2, timing 0–2, total 0–20, priority band.
- [x] `ConferenceMeeting` with reason, proposed ask, intro path, and status.
- [x] Prisma migration, repository mapping, and permissions.

## Scoring

- [x] 20-point domain function with range validation.
- [x] Priority bands: 16–20 request meeting, 12–15 personalized outreach, 8–11 nurture, below 8 do not prioritize.
- [x] Manual score edits with source notes and audit history.

## Import and research

- [x] CSV preview/commit for companies, people, and meetings.
- [x] Company fit flags: product, expansion, budget, market entry, partnership.
- [x] Saved search prompt helper using the conference name plus generic buyer/event terms.
- [x] Organizer-access email template that asks about opt-in directories and consent, not unofficial attendee lists.

## Compliance

- [x] Require lawful-basis notes before storing an outreach email.
- [x] Block outreach actions for opted-out people.
- [x] Keep source and consent fields visible in the people workflow.
