# GOStore incident response procedure

Prepared: 2026-11-18. Status: ready for owner review/adoption; no exercise or prior review is claimed.
Scope: GOStore web/mobile/admin systems, hosting, databases/backups, deployment systems and supplier credentials, including any future authorized Amazon Information.

## Responsibilities

- Incident owner and Amazon contact: Enkhbat Tungalagtamir, Arvis Trans KLTC; business contact shop@gostore.mn / +976 86079077. Confirms severity, delegates containment and sends required notifications. Confirm an alternate contact and monitored alert channel before adoption.
- Technical responder: assigned by the incident owner for each incident. Preserve evidence, determine exposure, contain, recover and document actions. Do not assume an unavailable person is on call.
- Hosting response: hosting provider's incident team. Obtain a monitored escalation contact and service commitment; shared-hosting infrastructure is outside GOStore application administrator control.

## Detect, record, contain

1. Record detection time in UTC, reporter, affected systems and suspected data types. Examples: leaked credentials, unauthorized login, malware, unexpected exports, altered deployment files, exposed backup or a provider alert. Treat suspected exposure as an incident pending investigation.
2. Create an access-restricted incident record outside the public web root/repository. Keep a timeline, relevant audit/access logs, affected deployment versions and evidence hashes. Do not copy passwords, tokens or unnecessary customer records into tickets or chat.
3. Notify the incident owner immediately; aim for triage within one hour. Contain compromised accounts/integration access, revoke affected tokens/sessions and rotate exposed credentials through their provider. Coordinate infrastructure isolation with hosting support. Preserve evidence before destructive repair where practical; do not delay urgent containment.
4. Assess Amazon Information involvement, categories/approximate volume, unauthorized access duration and dependencies. Do not wait for a complete root-cause analysis to meet reporting deadlines.

## Amazon reporting

For any security incident involving Amazon Information, the incident owner must notify **security@amazon.com within 24 hours of detection**, following applicable Amazon instructions. Record sent time, destination and case reference. If uncertain about scope, state known facts and uncertainties; do not falsely claim the incident is resolved. Reporting is a human action; this document does not automatically send email.

Initial notification should include organization/app identifiers, detection time, contact, affected systems and data categories, observed impact, containment steps, remaining risks and next update time. Do not attach secrets or raw personal data. Coordinate any other legally required communications with appropriate advisers.

## Recovery and review

- Remediate the entry point; deploy verified clean code, patch affected dependencies, restore integrity-checked backups if necessary, and rotate affected credentials. Confirm access boundaries and monitor for recurrence before reopening integrations.
- Document cause, impact, detection gaps, action owners/deadlines and closure evidence. Preserve incident evidence securely according to applicable retention requirements and remove unnecessary copies.
- Review this plan **at least every six months**, after a major system change and after an incident. Run an exercise covering leaked API credentials and hosting compromise. Keep dated review/exercise records and corrective actions.
- Proposed first review deadline: 2027-05-18 if adopted on preparation date. Adoption date, next review, alternate contact and exercise evidence must be recorded by the owner; no automated reminder is currently configured.

## Incident record template

Incident ID; detected UTC; reporter; incident owner; technical responder; systems; Amazon Information involved/unknown; severity; containment timeline; notification deadline; notification sent UTC/case ID; evidence locations/hashes; root cause; recovery checks; monitoring; corrective action owners/dates; closure approval; next plan review.
