# COOP-LOANING
COOP LOANING
# CampusCoop — Cooperative Loan Management System (SKSU)

Web-based loan management system for **Sultan Kudarat State University (SKSU) Cooperative**.
Members apply and pay online. Officers review, approve, release, and collect.

## Tech Stack

* **Backend:** Google Apps Script (Web App, `Asia/Manila`)
* **Frontend:** HTML / CSS / JS pages served by `doGet(e?page=...)`
* **Database:** Google Spreadsheet — the Apps Script uses a connected Google Spreadsheet as its database
* **Notifications:** Gmail (email) + TextBee (SMS)
* **Proof storage:** Google Drive

## How It Works

### 1. Users
* **Members:** Login with mobile number. Default password must be changed on first login. Password reset via email link.
* **Officers:** Roles are `regular`, `shortterm`, `commodity`, `treasurer`, `chairperson`, plus super-admin. First sign-in forces email + password change.
* **Eligibility:** Teachers can use Regular + Short Term + Commodity. Job Order members can use Short Term + Commodity only.

### 2. Member Flow
1. Officer enrolls member -> member gets Login ID + temp password via SMS/email.
2. Member logs in, completes profile setup, opens dashboard to see CBU, max loanable, loans, and payments.
3. Member applies for a loan (choose type, amount, term with live calculator) -> application goes to `Pending` -> member gets confirmation email. Amount is checked against CBU limit.
4. Member pays via Counter cash or Online GCash/Bank with proof image -> payment goes to `Pending` -> admin is notified.
5. Member receives emails on Approved / Rejected / Released / Payment Confirmed.

### 3. Officer / Admin Flow
1. **Review Applications:** View Pending list with CBU, max loanable, monthly estimate, past dues and deductions, and net proceeds `A - (B+C)`. Approve or Reject with reason.
2. **Approve:** Sets status to `Approved (In Settlement)`, creates loan record with LoanID (`REG-` / `STL-` / `COM-`), deducts amount from member CBU, sends emails.
3. **Release (Treasurer):** Releases `In Settlement` loans, sets claiming date/time/location, sends release email. Supports batch release.
4. **Payments:** Confirm generates Official Receipt number (`OR-YYYYMMDD-XXXXX`) and deducts loan balance, marks `Paid` if zero, sends email + SMS. Or marks `Under Review` / `Rejected`.
5. **Other tasks:** Manage members, collections, overdue, reports/analytics, deduction settings, bulk import of old loans, officer accounts, system settings.

## Database

The system uses a **Google Spreadsheet as its database via Google Apps Script**.

The admin connects the spreadsheet once in Settings by pasting the Sheet URL. The Apps Script reads and writes all members, loan applications, loans, and payments directly to that spreadsheet. No separate database server is needed.

## Loan Products & Interest

| Type | Interest | Max Amount | Term | Who |
|---|---|---|---|---|
| **Regular** | **1% per month, diminishing** on remaining balance | **₱200,000** or 3x CBU, whichever is lower | **12–60 months (1–5 years)** | **Teachers only** |
| **Short Term (STL)** | **6% flat one-time** | **₱15,000** | **1–6 months** | All members |
| **Commodity** | **1% per month × term** (1mo = 1%, 2mo = 2%) | **₱5,000** | **1–2 months** | All members (coop-store goods) |

### How monthly is computed
* **Regular:** 1st month `= Amount ÷ Term + Amount × 0.01`. Interest drops every month as balance goes down. Total payable = principal, interest collected separately.
* **Short Term:** `Total = Amount × 1.06`, `Monthly = Total ÷ Term`
* **Commodity:** `Total = Amount × (1 + 0.01 × Term)`, `Monthly = Total ÷ Term`

### CBU loanability
* Regular: up to **300% of CBU (3x capital)**, max ₱200,000
* Short Term: up to **80% of CBU**, max ₱15,000 (Teachers up to 300%)
* Commodity: up to **80% of CBU**, max ₱5,000

On approval, the loan amount is deducted from the member's CBU. Past dues and fees (Capital Build-up, Service Fee, Insurance, Notarial) are deducted from the loan to compute **Net Proceeds = Amount − (Past Dues + Deductions)**, which is what the member receives.


Link of the google sheet regular loans
https://docs.google.com/spreadsheets/d/1RVUDl7EJ3Va7sV76aFj5WkbVIXDKoIt8/edit?usp=sharing&ouid=115148236032753555241&rtpof=true&sd=true
 this is the example / data that the prof wants to show, even though its not that necessary



