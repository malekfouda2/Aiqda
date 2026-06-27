# Instructor Revenue, Completion Eligibility & Manual Payout Module
## Implementation Plan and Claude Code Prompt

## Confirmed business decisions

1. A subscription can grant learners access to **multiple chapters and multiple instructors**.
2. An administrator decides each chapter's revenue allocation percentage.
3. Administrators may change allocation percentages over time.
4. Subscription prices already include VAT. Do not add separate VAT logic to the instructor-payout formula.
5. The platform uses Tap only to collect subscription payments. Instructor payouts are **manual** and must never use Tap split payments, Tap transfers, or automatic disbursement.
6. If a learner payment is refunded or charged back after an instructor has been paid, the system must automatically create an instructor recovery balance. That negative balance is recovered from future instructor payouts unless an authorized admin records a manual settlement or adjustment.
7. The **30% instructor pool is calculated from the learner's actual successful paid amount before gateway fees**.
8. Tap/payment-gateway fees are a separate platform expense. They do not reduce the instructor pool.

---

# Financial constitution

The platform collects 100% of every learner subscription payment.

For each successful payment or renewal:

```text
gross_paid_amount = actual amount paid by the learner
maximum_instructor_pool = gross_paid_amount × 30%
platform_gross_share_before_gateway_fees = gross_paid_amount × 70%
gateway_fee = actual Tap/payment processing fee
platform_cash_after_gateway_fees_and_instructor_liability =
  gross_paid_amount - gateway_fee - instructor_payout_liability
```

The instructor pool is always calculated from the **actual amount paid**, not from the original listed price and not from the amount remaining after Tap fees.

This means discounts, coupons, promotional pricing, and upgraded/downgraded subscription prices must use the final amount actually paid by the learner.

## Example

```text
Learner actual payment:                    499.00 SAR
Tap gateway fee:                            25.00 SAR
Maximum total instructor pool (30%):       149.70 SAR
Platform gross share before Tap fee (70%): 349.30 SAR
Platform cash after Tap fee and full
instructor liability:                      324.30 SAR
```

Calculation:

```text
499.00 × 30% = 149.70 SAR
499.00 × 70% = 349.30 SAR
499.00 - 25.00 - 149.70 = 324.30 SAR
```

Important interpretation:

- The platform is entitled to at least 70% of the **gross learner payment allocation**.
- Tap fees are an additional platform cost and are not shared with instructors.
- Therefore, the platform's cash remaining after gateway fees may be lower than 70% of the gross paid amount.
- The system must show these figures separately so finance/admin users do not confuse allocation share with final cash retained.

---

# Instructor earning rule

An instructor does not earn money immediately when a learner buys a subscription.

A successful subscription creates only a **potential earning** for each relevant chapter/instructor allocation.

The instructor becomes eligible for their chapter-specific earning only after the learner completes at least **80% of the required lessons in that instructor's chapter**.

## Completion formula

```text
chapter_completion_percentage =
  completed_required_active_lessons / total_required_active_lessons × 100
```

Eligibility rule:

```text
chapter_completion_percentage >= 80%
```

Examples:

```text
10 required active lessons:
- 7 completed = 70% = not eligible
- 8 completed = 80% = eligible
- 9 completed = 90% = eligible

12 required active lessons:
- 9 completed = 75% = not eligible
- 10 completed = 83.33% = eligible
```

This is a threshold gate, not a progressive payment rule.

- At 10%, 50%, or 79% completion, the instructor earns 0 SAR.
- At 80% completion or more, the instructor becomes eligible for their full allocated amount for that learner/payment/chapter.
- Repeated progress events must never create duplicate earnings.

---

# Multiple chapters and instructors

A single subscription may include many chapters taught by different instructors.

The total instructor pool for one learner payment cannot exceed 30% of that learner's actual paid amount.

Each chapter has an admin-defined allocation weight.

## Example with multiple instructors

```text
Learner paid:                           499.00 SAR
Maximum total instructor pool:          149.70 SAR

Chapter A / Instructor A allocation:    40%
Chapter B / Instructor B allocation:    35%
Chapter C / Instructor C allocation:    25%

Total allocation:                       100%
```

Maximum payouts once the learner meets the 80% threshold in each relevant chapter:

```text
Instructor A:
149.70 × 40% = 59.88 SAR

Instructor B:
149.70 × 35% = 52.40 SAR

Instructor C:
149.70 × 25% = 37.43 SAR
```

If the learner reaches 80% only in Chapters A and B:

```text
Eligible Instructor A earning:          59.88 SAR
Eligible Instructor B earning:          52.40 SAR
Pending Instructor C potential earning: 37.43 SAR
Total current instructor liability:     112.28 SAR
Unrealized instructor exposure:          37.43 SAR
```

Rules:

1. Chapter allocation weights across a subscription entitlement may total **up to 100%**, never more.
2. The collective instructor payout across all chapters for one learner payment may never exceed 30% of that payment.
3. A chapter can have one primary instructor initially. Design the data model so multiple instructors per chapter can be supported later through sub-allocations.
4. Any unallocated portion of the 30% instructor pool remains with the platform.
5. Optional lessons must not count toward the 80% denominator unless explicitly configured as required.

---

# Allocation versioning and historical safety

Admins can change allocation percentages, but edits must not silently rewrite historical financial records.

Implement allocation versioning.

Each allocation configuration must have:

- Subscription plan or entitlement scope
- Chapter
- Instructor
- Allocation percentage
- Effective start date/time
- Optional effective end date/time
- Status: draft, active, superseded, archived
- Created by
- Approved by, if applicable
- Audit log history

When a learner successfully pays:

1. Determine the active allocation configuration at that exact payment date/time.
2. Snapshot the allocation percentage into the financial earning record.
3. Snapshot the chapter/lesson structure used for completion eligibility.
4. Future admin allocation edits apply only to new payments or renewals after the new allocation becomes active.
5. Historical payout records must remain unchanged.
6. If finance needs to change a past calculation, create an explicit positive or negative adjustment record with a reason, rather than editing the original earning.

This protects historical payout records and prevents retroactive changes from creating disputes.

---

# Refund, cancellation, chargeback, and recovery rules

## Before an instructor is paid

If the learner payment is fully refunded, charged back, or invalidated before instructor payout:

- Pending potential earnings must become `voided`.
- Eligible but unpaid earnings must become `voided` or reduced proportionally for partial refunds.
- Do not delete records.
- Create a financial adjustment/reversal record linked to the refund or chargeback.
- Record the reason, timestamp, actor/system source, and affected amount.

## After an instructor is paid

If the instructor has already been paid and the learner payment is later refunded or charged back:

1. Automatically create a negative instructor recovery balance.
2. Link the recovery balance to:
   - the original learner payment
   - the original instructor earning
   - the refund/chargeback event
   - the instructor
   - the affected chapter
3. Deduct the recovery amount from future approved payouts for that instructor automatically.
4. Do not create a negative manual payout automatically.
5. If future earnings are insufficient, show the remaining recovery balance as outstanding.
6. Let finance admins record manual repayment, waive the recovery, or create an adjustment only through explicit permission-protected actions with audit reasons.

For partial refunds, calculate the reversal proportionally unless finance settings specify another approved policy.

Example:

```text
Original learner payment:                 499.00 SAR
Instructor earned and was paid:            59.88 SAR
Later refund:                              50% of payment
Automatic instructor recovery balance:     29.94 SAR
```

---

# Required financial states

## Instructor earning status

```text
pending_completion
eligible
on_hold
approved_for_payout
partially_paid
paid
voided
reversed
```

Definitions:

- `pending_completion`: learner paid, but learner has not reached 80% in this chapter.
- `eligible`: learner reached 80%; earning is available for admin review.
- `on_hold`: finance paused the earning with an internal reason.
- `approved_for_payout`: approved and available for a manual payout batch.
- `partially_paid`: some amount has been manually paid, but balance remains.
- `paid`: amount fully settled.
- `voided`: not payable due to cancellation/refund/invalid payment before payout.
- `reversed`: previously eligible or paid earning has a linked reversal/recovery action.

## Manual payout batch status

```text
draft
awaiting_approval
approved
processing_manually
partially_paid
paid
cancelled
voided
```

---

# Financial records to store

Use integer minor currency units (halalas for SAR) for all monetary calculations. Never use floating point for money.

## 1. Payment financial transaction

Store:

- Transaction ID
- Learner ID
- Subscription ID
- Subscription plan ID
- Tap payment/reference ID
- Parent/original transaction ID where applicable
- Transaction type:
  - initial_subscription
  - renewal
  - upgrade
  - downgrade
  - refund
  - partial_refund
  - chargeback
  - manual_adjustment
- Gross actual paid amount
- Discount amount
- Gateway fee
- Refunded amount
- Chargeback amount
- Currency
- Payment status
- Payment date/time
- Subscription entitlement start/end dates
- Raw gateway response reference where safe/appropriate
- Created/updated timestamps

## 2. Chapter entitlement snapshot

For every payment/subscription entitlement, store:

- Learner ID
- Payment transaction ID
- Subscription plan ID
- Chapter ID
- Chapter title snapshot
- Chapter version or content snapshot ID
- Instructor ID
- Allocation percentage snapshot
- Required lesson count snapshot
- Completion threshold snapshot: default 80%
- Entitlement active start/end dates

## 3. Instructor earning ledger record

Store:

- Earning ID
- Learner ID
- Instructor ID
- Chapter ID
- Payment transaction ID
- Entitlement snapshot ID
- Gross paid amount basis
- Instructor payout cap snapshot: default 30%
- Chapter allocation percentage snapshot
- Maximum potential earning amount
- Current eligible/approved/paid amount
- Completion percentage at eligibility
- Completed required lesson count
- Total required lesson count
- Eligibility timestamp
- Status
- Hold reason
- Void/reversal reason
- Recovery balance amount
- Payout batch IDs/history
- Created/updated timestamps

## 4. Manual payout batch

Store:

- Payout batch ID
- Instructor ID
- Currency
- Total approved amount
- Total paid amount
- Total remaining amount
- Included earning records
- Settlement method:
  - bank_transfer
  - cash
  - wallet
  - other
- Settlement reference number
- Settlement date/time
- Optional attachment/proof reference
- Notes
- Created by
- Approved by
- Marked paid by
- Status
- Full timestamps

## 5. Audit log

Every financial action must record:

- Actor type: admin, system, payment webhook
- Actor ID where applicable
- Action type
- Target entity type and ID
- Old state
- New state
- Timestamp
- Reason/note
- Related request/webhook identifier where applicable

Never delete ledger, payout, or audit records.

---

# Required admin dashboard

Build a new **Financial Management** module in the admin dashboard.

## A. Financial overview

Include date filters and show:

- Gross successful subscription payments
- Discounts
- Refunds
- Chargebacks
- Tap gateway fees
- Net cash collected after gateway fees
- Total maximum instructor exposure:
  - gross paid amount × 30%
- Pending instructor potential earnings:
  - learner has not reached 80%
- Eligible instructor payout liability:
  - learner reached 80%, not yet paid
- Approved but unpaid payout amount
- Actual instructor payouts made
- Instructor recovery balances
- Platform gross allocation:
  - gross paid amount × 70%
- Platform cash after gateway fees and current instructor liabilities
- Platform cash after actual instructor payouts
- Revenue by subscription plan
- Revenue by instructor
- Revenue by chapter
- Revenue by month
- Payouts by month
- Refunds/chargebacks by month
- Learners near the 80% threshold
- Learners who reached the threshold

Use clear explanations in the UI to distinguish:

1. Gross payment received from learner
2. Tap gateway fee
3. Maximum instructor payout pool
4. Potential but not earned instructor amount
5. Eligible instructor liability
6. Approved but unpaid instructor amount
7. Actual cash paid to instructors
8. Platform's 70% gross allocation
9. Platform cash after Tap fees and instructor obligations

## B. Instructor financial profile

For each instructor show:

- Assigned chapters
- Allocation percentages
- Learners with active entitlement
- Learners below 80%
- Learners at or above 80%
- Potential earnings
- Eligible earnings
- Approved unpaid earnings
- Paid earnings
- Current unpaid balance
- Recovery balance
- Reversed/voided amounts
- Manual payout history
- Learner-level financial ledger

The learner-level ledger must show:

- Learner name
- Subscription plan
- Payment date
- Actual paid amount
- Tap fee
- Chapter
- Allocation percentage
- Maximum earning
- Current completion percentage
- Eligibility date
- Earning status
- Paid amount
- Remaining amount
- Recovery balance
- Payout batch/reference
- Admin notes

## C. Earnings queue

Provide a finance/admin table with filters for:

- Date range
- Instructor
- Chapter
- Learner
- Subscription plan
- Earning status
- Completion threshold reached/not reached
- Paid/unpaid
- Payout batch
- Minimum/maximum amount

Bulk actions:

- Approve selected earnings
- Put selected earnings on hold
- Create payout batch
- Add note
- Void/reverse with reason
- Export CSV/XLSX

## D. Manual payout batches

Required capabilities:

- Create batch by instructor
- Include only approved, unpaid earning balances by default
- Prevent the same amount from being included in more than one active batch
- Support partial payout amounts
- Record manual settlement method and reference
- Attach proof/reference where supported
- Mark batch as paid manually
- Show remaining unpaid balances
- Automatically apply existing instructor recovery balances against future payouts
- Preserve immutable batch history
- Export payout summary for finance

## E. Revenue allocation settings

Finance/admin settings should include:

- Instructor payout cap: default 30%
- Platform gross allocation: default 70%
- Completion threshold: default 80%
- Chapter-to-instructor allocation rules
- Required vs optional lesson treatment
- Tap fee source:
  - actual gateway fee preferred
  - estimated fee only when actual fee is unavailable
- Refund/chargeback recovery policy
- Currency and rounding rules

These settings must be permission-protected and fully audit logged.

---

# Required validation and safety rules

1. Do not create earnings for failed, pending, free, or zero-value payments.
2. Use the actual amount paid after discounts as the payout basis.
3. Do not deduct Tap fees from the instructor pool formula.
4. Never allow total chapter allocations above 100% for the same subscription entitlement.
5. Never allow combined instructor earning potential above 30% of one payment.
6. Keep the platform gross allocation at 70% of the actual paid amount.
7. If allocations total less than 100%, the unused instructor pool belongs to the platform.
8. Make payment webhooks idempotent.
9. Make completion eligibility events idempotent.
10. Do not generate duplicate earnings for the same learner + payment transaction + chapter entitlement + instructor.
11. Renewals create separate financial transactions and separate earning cycles.
12. Keep historical allocation and lesson-count snapshots.
13. Do not modify original ledger records; use adjustments, reversals, recovery records, and notes.
14. Apply recovery balances automatically against future instructor payouts before creating a payable payout amount.
15. All sensitive actions require role-based permissions and audit logs.
16. Use transactions/locking to avoid duplicate payouts and race conditions.

---

# Required roles and permissions

Implement or reuse role-based permissions:

```text
finance.view_dashboard
finance.view_instructor_financials
finance.view_earnings
finance.manage_earnings
finance.approve_payouts
finance.create_payout_batches
finance.mark_payouts_paid
finance.manage_allocation_settings
finance.manage_adjustments
finance.export_reports
finance.view_audit_logs
```

Instructors must not see platform-wide financial information.

If an instructor-facing page is later enabled, it must show only their own chapters, learners, earnings, recoveries, payouts, and history.

---

# Claude Code implementation request

You are working on an existing subscription learning platform with a functioning Tap payment gateway and an existing admin dashboard.

Implement the financial module described in this document.

## Mandatory constraints

- Preserve the existing subscription and payment flow.
- Do not implement Tap split payments.
- Do not implement automatic transfers or automatic instructor payouts.
- All instructor payments are manual and are tracked internally.
- The instructor pool must be calculated from the learner's actual successful gross payment amount:
  `actual_paid_amount × 30%`.
- Do not subtract Tap gateway fees before calculating instructor earnings.
- Tap fees are a separate platform expense.
- A learner must complete at least 80% of the required active lessons in a specific chapter before that chapter's instructor becomes eligible for their allocated earning.
- A subscription can include multiple chapters and instructors.
- Admins control chapter allocation percentages.
- Allocation changes must be versioned and prospective. Do not retroactively alter historical financial records.
- Refunds and chargebacks after payout must automatically create instructor recovery balances.

## Work process

1. Inspect the existing project architecture before modifying code:
   - database schema
   - subscription models
   - Tap payment/webhook integration
   - user and role models
   - course, chapter, lesson, and completion models
   - existing admin patterns
   - testing conventions
2. Provide a concise implementation plan based on the actual codebase.
3. Implement in safe phases with migrations, backend logic, APIs, admin UI, permissions, audit logging, and tests.
4. Reuse existing project conventions and components wherever possible.
5. Do not break the existing subscription checkout, payment confirmation, or learner progress flow.

## Required automated tests

Add tests for at least:

1. 79% chapter completion does not create eligibility.
2. Exactly 80% chapter completion creates eligibility.
3. More than 80% remains eligible without duplicate earning creation.
4. Multiple instructor allocations correctly divide a 30% gross payment pool.
5. Allocation total above 100% is rejected.
6. Combined instructor potential above 30% is rejected.
7. Tap fee does not reduce the instructor pool.
8. Coupon/discount uses actual paid amount.
9. Payment webhook retries do not duplicate financial records.
10. Lesson-completion retries do not duplicate earnings.
11. Refund before payout voids/recalculates eligible earnings.
12. Refund after payout creates a recovery balance.
13. Partial payout maintains the correct unpaid balance.
14. Recovery balance is automatically deducted from a future payout.
15. Renewal creates a new independent payment and earning cycle.
16. Allocation changes apply prospectively and do not alter prior payment snapshots.

## Required deliverables

- Database migrations
- Financial transaction ledger
- Chapter entitlement snapshots
- Allocation versioning
- Instructor earning ledger
- Completion eligibility engine
- Admin financial overview
- Instructor financial profile
- Earnings queue
- Manual payout batches
- Refund/chargeback recovery engine
- Audit logs
- CSV/XLSX exports
- Permissions
- Automated tests
- Short technical documentation explaining formulas, lifecycle, recovery behavior, and admin operating process
