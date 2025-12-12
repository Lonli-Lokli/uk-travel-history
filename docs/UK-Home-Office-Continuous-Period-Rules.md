# UK Home Office: Calculating Continuous Period for ILR

**Source:** Home Office Guidance v22.0 (Published 01 December 2020)
**Document:** Indefinite leave to remain: calculating continuous period in UK

## Overview

This document summarizes the official UK Home Office guidance on calculating the continuous period requirement for Indefinite Leave to Remain (ILR) applications.

## Key Principles

### Continuous Period Requirement

The continuous period is the **minimum amount of time** which a migrant must spend in employment or being active in the UK economy before being eligible to qualify for ILR.

**Critical Rules:**
- The period must be spent **lawfully** in the UK with valid leave to enter or remain
- Absences from the UK are examined to determine if they break continuity
- The continuous period varies by visa route (typically 2, 3, or 5 years)

### Definition of the UK

For immigration purposes, **'UK' means Great Britain and Northern Ireland only.**

It does **NOT** include:
- Channel Islands
- Isle of Man
- UK continental shelf beyond 12 nautical miles (e.g., oil rigs, ships)

## Calculating Absences

### 180-Day Limit (Rolling 12-Month Period)

**For leave granted on or after 11 January 2018:**

> **No more than 180 days' absences are allowed in a consecutive 12-month period.**

#### Important Calculation Rules:

1. **Whole Days Only**
   - You must only include **whole days** in this calculation
   - **Part-day absences** (less than 24 hours) are **NOT counted**
   - Example: If applicant departs UK on Day 1 and returns on Day 181, this equals exactly 180 days (acceptable)

2. **Rolling Basis**
   - Absences are considered on a **rolling 12-month basis**
   - This means checking EVERY possible 12-month window throughout the continuous period
   - Not just calendar years or fixed periods

3. **Departure and Return Days Excluded**
   - The day of departure from the UK is **NOT counted** as an absence
   - The day of return to the UK is **NOT counted** as an absence
   - Only the **full days between** departure and return count

### Formula for Full Days Outside UK

When calculating absences for a trip:

```
Full Days Outside UK = (Return Date - Departure Date) - 1
```

**Example:**
- Departure: 15 January 2020
- Return: 20 January 2020
- Calculation: (20 Jan - 15 Jan) - 1 = 4 full days outside UK
- Days excluded: 15 Jan (departure day) and 20 Jan (return day)

### Calculating Rolling Period Overlaps

When checking if trips fall within rolling 12-month windows, the application uses the following approach:

1. **Define Absence Period**: For each trip, the absence period is the days BETWEEN departure and return (exclusive of both)
   - Absence Start = Departure Date + 1 day
   - Absence End = Return Date - 1 day

2. **Calculate Intersection**: For each 12-month window, calculate the intersection of the absence period with the window
   - Intersection Start = MAX(Absence Start, Window Start)
   - Intersection End = MIN(Absence End, Window End)

3. **Count Days**: If intersection is valid (Start ≤ End), count days inclusively
   - Days in Window = (Intersection End - Intersection Start) + 1

**Example:**
- Trip: 10 January - 20 January (9 full days total)
- Window: 15 January 2024 - 14 January 2025
- Absence Period: 11 Jan - 19 Jan
- Intersection: 15 Jan - 19 Jan
- Days counted in this window: (19 - 15) + 1 = 5 days

This ensures that partial trip overlaps are correctly calculated and that departure/return days are properly excluded.

### Transitional Arrangements

**For leave granted BEFORE 11 January 2018:**
- Absences considered in **consecutive 12-month periods** ending on date of application
- Not on a rolling basis

**Mixed Periods:**
If continuous period includes leave both before AND after 11 January 2018:
- Old grant: Use consecutive 12-month periods
- New grant: Use rolling basis (don't include absences from old grant)

## Calculating the Continuous Period

### Start Date

The continuous period starts from:
- **Vignette entry date** (the date the person first entered the UK on their visa), OR
- **Visa start date** (the date their visa/leave officially began)

Whichever is the **earlier date** should be used.

### Continuous Leave Calculation

```
Days in UK = (Total days since start date) - (Total full days outside UK)
```

This represents actual days physically present in the UK.

### Application Timing

Applicants can submit settlement applications **up to 28 days before** they reach the end of the specified period.

#### Counting Backward from Application/Decision Date

Per Home Office guidance, when assessing an ILR application, the qualifying period should be calculated by **counting backward** from whichever of the following is **most beneficial to the applicant**:
- Date of application
- Date of decision
- Any date up to 28 days after the date of application

**Implementation**: The application now supports both modes:

1. **Prospective mode (default)**: Calculates the earliest application date (28 days before the required period ends) and monitors rolling 12-month periods prospectively from the visa start date to today.

2. **Retrospective mode (backward counting)**: When you enter an application date, the app simulates the actual Home Office assessment by:
   - Counting backward from the application date by the required number of years (e.g., 5 years)
   - Testing multiple assessment dates (application date + 0 to 28 days)
   - Selecting the most beneficial assessment date (with lowest maximum rolling absence)
   - Checking that no rolling 12-month period within that continuous period exceeded 180 days

**Example:**
- Visa start: 1 January 2020
- Required period: 5 years
- Application submitted: 10 December 2024 (within the 28-day early window)

When you enter "10 December 2024" as the application date, the app will:
- Test assessment dates from 10 Dec 2024 to 7 Jan 2025 (28-day window)
- For each date, count backward 5 years to establish the qualifying period
- Calculate the maximum rolling 12-month absence for each qualifying period
- Display results for the most beneficial assessment date

This matches how the Home Office will assess your application, choosing whichever period shows the least absences, as long as it covers the required continuous period.

## Allowable Absences

### Categories Not Requiring Reasons (if ≤180 days/12 months)

- Tier 1 (Entrepreneur)
- Tier 1 (Investor)
- Retired person of independent means
- Tier 1 Entrepreneur and Tier 1 Investor dependants

### Categories Requiring Reasons

For other categories (e.g., Domestic workers, Skilled Workers), absences must be:
1. **Consistent with original purpose** of entry to UK (e.g., business trips, work-related travel)
2. For **serious or compelling reasons**

#### Work-Related Absences

Acceptable reasons include:
- Business trips or short secondments
- Paid annual leave (in line with UK entitlement: typically 5.6 weeks or 28 days per year)
- Weekend/non-working day trips (must count toward 180-day limit)

**Evidence required:** Letter from employer explaining absences

**Interim allowance:** If absences don't exceed 30 working days + statutory holidays per year, may proceed without documentation (caseworker discretion)

#### Serious or Compelling Reasons

Examples include:
- Serious illness of applicant or close relative
- Conflict
- Natural disaster (volcanic eruption, tsunami)
- Disruption to travel arrangements

**Evidence required:** Letter explaining reason + supporting documents (medical certificates, death certificates, travel disruption evidence)

### NOT Allowable

- **Employment outside UK** that shows UK employment is secondary
- Extended periods away, especially if business no longer exists
- Absences >180 days in any 12-month period for employment reasons (not exceptional)

### Special Exemptions

**Do NOT count toward 180-day limit:**
- Absences due to assisting with national/international **economic or humanitarian crisis** (e.g., Ebola crisis)
  - Applies to: Tier 1 Entrepreneur, Tier 1 Investor, and dependent partners
  - Evidence required
- Full-time service overseas as member of **HM Armed Forces Reserve** (treated as UK employment)

## Breaks in Continuous Period

### What Breaks Continuity

The continuous period is **broken** if:
- Applicant spent time in UK **without valid leave** (overstaying)
- Leave expired while outside UK and new entry clearance applied **too late**
- Absences exceed **180 days in any 12-month period** (unless exceptional circumstances)

### Acceptable Breaks (Pre-24 November 2016)

Period of overstaying disregarded if:
- New entry clearance application made within **28 days** of leave expiry
- OR exceptional circumstances (serious illness, travel delays, document issues)

### Acceptable Breaks (On/After 24 November 2016)

More strict: Overstaying disregarded only if:
- Application made within **14 days** of leave expiry
- AND good reason beyond applicant's control provided
- OR specific circumstances apply (refusal of previous in-time application, etc.)

### Absences While Outside UK

**Pre-24 November 2016:**
- Continuous period maintained if applicant applies for new entry clearance within **28 days** of leave expiry

**On/After 24 November 2016:**
- Must apply for entry clearance **before leave expires** OR
- Within **14 days** after expiry with good reason beyond control

If gap exceeds these limits, **continuous period is broken** and leave is not aggregated.

## Exceptional Cases

### Absences >180 Days

If absences exceed 180 days in a 12-month period, ILR normally **refused**.

**However,** may grant ILR exceptionally if:
- Evidence shows excessive absence due to **serious or compelling reasons**
- Examples: serious illness, conflict, natural disaster
- NOT for employment or economic activity reasons

**Approval requires:** Senior Executive Officer level authorization

### Other Exceptional Circumstances

- Time overseas for pregnancy, maternity, paternity, parental leave, adoption, illness: treated same as other absences (within 180-day limit)
- Exempt status periods can count toward continuous period
- Deemed leave (90 days under Section 8A(b) Immigration Act 1971) counts toward continuous period

## Application Scope: Prospective vs Retrospective Assessment

### Two Assessment Modes

The application supports **both prospective and retrospective assessment modes**:

#### 1. Prospective Monitoring (Default Mode)

**When to use:** Daily monitoring and tracking ongoing compliance

This mode helps users track their ongoing compliance with ILR requirements in real-time. It:

1. Monitors rolling 12-month periods from the visa start date **forward to today**
2. Alerts users if any rolling period exceeds 180 days
3. Calculates when they become eligible to apply (28 days before required period ends)

This approach is **conservative and safe** - if the app shows you're compliant now, you'll likely pass the Home Office assessment.

**How to activate:** Simply enter your vignette entry date or visa start date and select your ILR track. Leave the "Application Date" field empty.

#### 2. Retrospective Assessment (Backward Counting Mode)

**When to use:** Simulating the actual Home Office assessment when planning or preparing your ILR application

This mode replicates how the Home Office actually assesses your application by:

1. Counting backward from your specified application/decision date
2. Checking the exact qualifying period (e.g., 5 years backward from that date)
3. Finding the most beneficial assessment date within the allowed window (application date, or up to 28 days after)
4. Verifying no rolling 12-month window in that period exceeded 180 days

**Why the difference matters:**
- Prospective: Checks from visa start to today (what you can monitor)
- Retrospective: Checks from chosen end date backward (what Home Office assesses)

For most users, these produce the same result. However, if you have trips planned near your application date, the retrospective assessment might be slightly more favorable since the Home Office can choose the most beneficial assessment date.

**How to activate:** Enter your vignette entry date/visa start date, select your ILR track, AND enter your planned "Application Date". The app will automatically switch to backward counting mode.

**Current Implementation Status:**
- ✅ Prospective monitoring (visa start → today): **Fully implemented**
- ✅ Retrospective simulation (counting backward from custom date): **Fully implemented** (as of this PR)

## Summary of Key Numbers

| Metric | Value | Notes |
|--------|-------|-------|
| **Maximum absence per 12 months** | 180 days | Whole days only; rolling basis (post-11 Jan 2018) |
| **Part-day absence threshold** | <24 hours | Not counted toward 180-day limit |
| **Application timing** | Up to 28 days early | Before end of qualifying period |
| **Overstay grace period (pre-24 Nov 2016)** | 28 days | For new application |
| **Overstay grace period (post-24 Nov 2016)** | 14 days | With good reason |
| **Statutory annual leave** | 5.6 weeks (28 days) | Typical UK entitlement for 5-day week |
| **Interim allowance** | 30 working days + holidays | May proceed without employer letter |

## Continuous Leave Calculation Formula

```
Start Date = Earlier of (Vignette Entry Date, Visa Start Date)

Total Days Since Start = Current Date - Start Date

Full Days Per Trip = (Return Date - Departure Date) - 1

Total Full Days Outside UK = Sum of all trip full days

Days in UK (Continuous Leave) = Total Days Since Start - Total Full Days Outside UK

180-Day Check = For every rolling 12-month window:
                Sum(Full Days Outside) ≤ 180
```

## Important Warnings

1. **Rolling 12-month check is critical:** Must check EVERY possible 12-month period, not just calendar years
2. **Whole days only:** Part-day trips don't count, but still represent presence in UK
3. **Departure and return days excluded:** Only full days between count as absence
4. **Different rules for different grant dates:** Pre/post 11 Jan 2018 and pre/post 24 Nov 2016
5. **Nationality vs ILR:** These rules apply to ILR only; nationality applications have different requirements

## Visa Routes Covered

**Common routes requiring continuous residence:**
- Skilled Worker (Tier 2 General)
- Global Talent (Tier 1 Exceptional Talent)
- Innovator
- UK Ancestry
- Representative of Overseas Business
- Tier 1 Investor (2, 3, or 5 years)
- Tier 1 Entrepreneur (3 or 5 years)
- Domestic workers in private households (5 years)
- Retired person of independent means (5 years)

## References

This summary is based on:
- **Document:** Indefinite leave to remain: calculating continuous period in UK
- **Version:** 22.0
- **Published:** 01 December 2020
- **Publisher:** UK Home Office (for Home Office staff)
- **Source:** `docs/calculating-continuous-period-v22.0ext.pdf`

---

**Disclaimer:** This is a summary for reference purposes. Always consult the official Home Office guidance and Immigration Rules for authoritative information. Immigration rules and policies may change over time.
