# Healix, Explained

*A plain-English guide to what Healix is, what it does, and how it works.*
*No engineering background required.*

---

## 1. What is Healix?

**Healix is an AI assistant that tests software apps automatically.**

When a developer builds a web application, they need to check that everything
works: that buttons do what they should, forms accept the right information,
logins succeed, and pages load correctly. Doing this by hand is slow and easy
to get wrong. Writing the automated "tests" that do this checking is itself a
big, tedious job.

Healix removes that work. A developer types one instruction inside their coding
tool, and Healix:

1. **Looks at the app** like a real user would — clicking around, filling forms.
2. **Writes the tests** automatically using AI.
3. **Runs the tests** against the app.
4. **Explains any failures** — and even suggests the fix.

The promise in one sentence:

> **Developers get hundreds of working tests without writing any of them by hand —
> and when something breaks, Healix tells them why.**

```mermaid
flowchart LR
    A["Developer types:<br/>'Test my app'"] --> B["Healix explores<br/>the app"]
    B --> C["AI writes<br/>the tests"]
    C --> D["Tests run<br/>against the app"]
    D --> E["Results + reasons<br/>shown on a dashboard"]
    style A fill:#dbeafe,stroke:#3b82f6
    style E fill:#dcfce7,stroke:#22c55e
```

---

## 2. Who uses it, and why it matters

| Audience | What they get |
|----------|---------------|
| **Developers** | Test coverage in minutes instead of days |
| **Teams shipping software** | Confidence the app works before customers see it |
| **Project / product owners** | Proof that the app meets the written requirements |

The everyday pain Healix solves:

- **Manual testing is slow** — checking every screen by hand takes hours.
- **Writing tests is a project of its own** — and the tests often break.
- **When a test fails, nobody knows why** — is the test wrong, or did the app break? Healix answers that question for you.

---

## 3. The two halves of Healix

Healix has two parts that work together. Think of it like a **field reporter**
and a **head office**.

```mermaid
flowchart TB
    subgraph LOCAL["On the developer's computer (the 'field reporter')"]
        MCP["Healix Helper<br/>(lives inside the coding tool)<br/><br/>• Looks at the app<br/>• Logs in as different users<br/>• Runs the tests<br/>• Takes screenshots & videos"]
    end

    subgraph CLOUD["In the cloud (the 'head office')"]
        WEB["Healix Cloud<br/>(the smart brain)<br/><br/>• The AI that writes tests<br/>• Stores all results<br/>• The dashboard you look at<br/>• Handles accounts & billing"]
    end

    MCP <-->|"secure internet connection<br/>(protected by a private key)"| WEB

    style LOCAL fill:#eff6ff,stroke:#3b82f6
    style CLOUD fill:#f5f3ff,stroke:#8b5cf6
```

**Why split it this way?**

- The **Helper** stays small and lives on the developer's machine, where the app
  actually runs. It needs to be close to the app to click around and run tests.
- The **Cloud** holds the expensive, powerful AI and all the saved history. It
  keeps the sensitive AI keys safe — they never touch the developer's computer.

The two communicate over a secure connection, and every message from the Helper
carries a **private key** (like a password) so the Cloud knows it's a real,
paying customer.

**What the Helper can do.** Although most people only ever use *"test my app,"*
the Helper actually offers five distinct commands the coding tool can call:

| Command | What it does |
|---------|--------------|
| **Configure** | Looks at the project and suggests settings before testing |
| **Test my app** | Runs the whole journey end to end (the main one) |
| **Check status** | Reports live progress while a test run is happening |
| **Analyze failures** | Diagnoses failures from an earlier run without re-testing |
| **Generate report** | Builds a results dashboard from existing results |

---

## 4. The journey, step by step

Here is what actually happens after a developer says *"Test my app."*
There are seven stages.

```mermaid
flowchart TD
    S1["1. Set up<br/>Confirm where the app lives and how to start it"]
    S2["2. Launch & explore<br/>Healix starts the app and clicks around like a user"]
    S3["3. Write the tests<br/>AI generates tests based on what it saw"]
    S4["4. Log in<br/>Healix signs in as each type of user (admin, customer...)"]
    S5["5. Run the tests<br/>Tests run in three groups (see below)"]
    S6["6. Capture evidence<br/>Screenshots, videos, and detailed logs are saved"]
    S7["7. Explain & report<br/>Failures are diagnosed; a dashboard link opens"]

    S1 --> S2 --> S3 --> S4 --> S5 --> S6 --> S7

    style S1 fill:#fef9c3,stroke:#eab308
    style S7 fill:#dcfce7,stroke:#22c55e
```

### Stage-by-stage in plain terms

1. **Set up.** Healix opens a short form. It has already guessed most of the
   answers (which app, how to start it). The developer can also hand it a
   **requirements document** (a written description of what the app *should* do)
   and **login details** for different kinds of users.

2. **Launch & explore.** Healix starts the app and a robot "user" browses
   through it — clicking buttons, opening pages, finding forms and login screens.
   It writes down everything it sees.

3. **Write the tests.** All of that information is sent to the Cloud, where AI
   writes the actual tests (more on this in Section 5).

4. **Log in.** If the app has accounts, Healix logs in as each role (for example,
   an *admin* and a *regular customer*) and remembers each session so it can test
   what each type of user is allowed to do.

5. **Run the tests.** Tests run in **three groups** (see Section 6).

6. **Capture evidence.** Whenever a test fails, Healix saves a **screenshot**, a
   **video** of what happened, and a **detailed log**. These are stored safely in
   the cloud, not left on the developer's computer.

7. **Explain & report.** Healix diagnoses each failure (Section 7) and opens a
   **dashboard** showing exactly what passed, what failed, and why.

---

## 5. How the AI writes the tests

Instead of one AI trying to do everything, Healix uses **four specialist AIs**,
each responsible for a different kind of test. They don't all run at once — they
work in a deliberate order so that later specialists can build on earlier ones.

```mermaid
flowchart TB
    INPUT["What the robot saw<br/>+<br/>the requirements document"]

    INPUT --> A1["1. Login Specialist (auth)<br/>Sign-in, sign-out, password rules.<br/>Runs FIRST, on its own —<br/>everything else may depend on a login"]

    A1 --> LOOP

    subgraph LOOP["2. For each feature, these two run side by side"]
        A2["Screen Specialist (ui)<br/>Buttons, forms, page navigation"]
        A3["Behind-the-scenes Specialist (api)<br/>The app's data connections"]
    end

    LOOP --> A4["3. Journey Specialist (e2e)<br/>Full stories, e.g. sign up → buy → review.<br/>Runs LAST, once everything else is ready"]

    A4 --> OUT["A complete set<br/>of tests"]

    style INPUT fill:#dbeafe,stroke:#3b82f6
    style A1 fill:#fef9c3,stroke:#eab308
    style OUT fill:#dcfce7,stroke:#22c55e
```

The order matters:

1. **Login Specialist** goes first and alone, because almost everything else
   needs a working sign-in before it can be tested.
2. **Screen Specialist** and **Behind-the-scenes Specialist** then work through
   the app one feature at a time, side by side — one checking what the user sees,
   the other checking the data underneath.
3. **Journey Specialist** goes last, stitching individual features into complete
   real-world stories (for example, *sign up → buy → leave a review*).

**Every test is traceable.** Each generated test is stamped with a tag linking it
back to a specific requirement from the written document. So a project owner can
see *"this requirement is covered by these tests"* — nothing is left to guesswork.

> **For large apps:** the same four specialists can also run as background jobs
> instead of all in one go, so even a huge app won't time out. Healix decides this
> automatically behind the scenes.

---

## 6. The three test groups (Tiers A, B, C)

Apps behave differently depending on whether you're logged in. Healix tests all
situations by splitting tests into three groups and running them together.

```mermaid
flowchart TB
    subgraph T["One Test Run"]
        TA["TIER A — Public<br/>Things anyone can do<br/>without logging in<br/>(e.g. view the homepage)"]
        TB["TIER B — Logged in<br/>Things each type of user can do<br/>(admin vs. customer vs. guest)"]
        TC["TIER C — Behind the scenes<br/>The app's internal data<br/>connections, checked directly"]
    end

    style TA fill:#dcfce7,stroke:#22c55e
    style TB fill:#dbeafe,stroke:#3b82f6
    style TC fill:#fef9c3,stroke:#eab308
```

| Tier | Plain meaning | Needs a login? |
|------|---------------|----------------|
| **A — Public** | What any visitor can see and do | No |
| **B — Logged in** | What each kind of user is allowed to do | Yes |
| **C — Behind the scenes** | The app's internal plumbing | No |

**A helpful safety feature:** if the login fails (wrong password, login server
down), only **Tier B** is paused. Tiers A and C still run, so you still get useful
results instead of a total failure.

---

## 7. When a test fails: who's to blame?

This is one of Healix's smartest features. A failed test doesn't always mean the
app is broken — sometimes the *test itself* is wrong. Healix figures out which.

```mermaid
flowchart TD
    FAIL["A test fails"] --> RULES["Step 1: Quick checks<br/>Fast, certain rules<br/>(e.g. 'the server was down')"]
    RULES -->|"clear answer"| VERDICT
    RULES -->|"unclear"| AI["Step 2: Ask the AI<br/>It reads the test, the requirement,<br/>and the evidence, then decides"]
    AI --> VERDICT["A verdict + a confidence level"]

    VERDICT --> V1["TEST is wrong<br/>→ Healix suggests a fix<br/>and can apply it automatically"]
    VERDICT --> V2["APP is wrong<br/>→ A real bug; the<br/>developer needs to fix it"]
    VERDICT --> V3["ENVIRONMENT issue<br/>→ Temporary glitch;<br/>usually fixed by retrying"]

    style FAIL fill:#fee2e2,stroke:#ef4444
    style V1 fill:#fef9c3,stroke:#eab308
    style V2 fill:#fee2e2,stroke:#ef4444
    style V3 fill:#e0e7ff,stroke:#6366f1
```

The three possible verdicts:

| Verdict | What it means | Who fixes it |
|---------|---------------|--------------|
| **Test is wrong** | The test expected the wrong thing | Healix — it suggests and can auto-apply the fix |
| **App is wrong** | A genuine bug in the app | The developer |
| **Environment issue** | A temporary glitch (server down, timeout) | Usually just retry |

Healix also reports a **confidence level**. If it's very confident the *test* is
wrong, it can fix the test and re-run on its own. If it's unsure, it flags the
failure for a human to look at.

---

## 8. The dashboard — what you see on screen

The dashboard is the web page where everyone (technical or not) can review
results. Here's what each section is for.

| Page | What you do there |
|------|-------------------|
| **Home** | A quick overview: recent runs, how many tests passed, account usage |
| **All Tests** | The full history of every test run, with pass/fail counts |
| **Test Run Detail** | A deep look at one run: the three tiers, each test, and the evidence (screenshots, videos, logs) for failures |
| **Workspace** | Groups runs by project, with a "Coverage Map" and tools to compare one run against another over time |
| **Create Tests** | Start a test run from the website (instead of the coding tool) |
| **Import Tests** | Bring existing tests into Healix |
| **MCP Server** | Setup and install instructions for the Helper inside the coding tool |
| **API Keys** | Manage the private key that connects the Helper to the Cloud |
| **Monitoring** | A live health view: success rates, common errors, trends |
| **Plan & Billing** | The current plan, usage, and upgrades |
| **Profile** | Personal account details |

The **Test Run Detail** page is where the action is. A simplified view (the
numbers below are just an example to show the layout):

```mermaid
flowchart TB
    subgraph RUN["Example — Test Run for 'My Shopping App'"]
        P["Tier A:  85 passed,  0 failed<br/>Tier B:  30 passed,  2 failed<br/>Tier C:  15 passed,  0 failed"]
        F["The 2 failures, expanded:<br/><br/>• Verdict: 'App is wrong'<br/>• Screenshot + video + log attached<br/>• Plain-English reason shown"]
        P --> F
    end
    style RUN fill:#f8fafc,stroke:#64748b
    style P fill:#ecfdf5,stroke:#10b981
    style F fill:#fef2f2,stroke:#ef4444
```

---

## 9. A mini glossary

| Term | Plain meaning |
|------|---------------|
| **Test** | An automatic check that one thing in the app works |
| **Test run** | One full session of Healix testing the app (produces many tests) |
| **Tier A / B / C** | The three groups: public, logged-in, and behind-the-scenes tests |
| **Artifact** | Evidence saved from a test: a screenshot, video, or detailed log |
| **Requirements document (PRD)** | A written description of what the app should do |
| **Acceptance criteria** | Specific, checkable statements pulled from that document (e.g. "users can reset their password") |
| **Verdict** | Healix's diagnosis of a failure: test wrong / app wrong / environment glitch |
| **Confidence level** | How sure Healix is about a verdict — high confidence means it can act on its own |
| **The Helper (MCP)** | The small Healix program inside the developer's coding tool |
| **The Cloud (webapp)** | The online brain: the AI, the dashboard, and the stored history |
| **API key** | A private password the Helper uses to prove who it is to the Cloud |

---

## 10. The whole picture, on one page

```mermaid
flowchart TB
    DEV["Developer in their coding tool<br/>types: 'Test my app'"]

    subgraph LOCAL["On the developer's computer"]
        EXPLORE["Explore the app<br/>(click around like a user)"]
        LOGIN["Log in as each user type"]
        RUNTESTS["Run the tests<br/>(Tiers A, B, C)"]
        EVIDENCE["Save screenshots,<br/>videos & logs"]
    end

    subgraph CLOUD["Healix Cloud"]
        WRITE["4 AI specialists<br/>write the tests<br/>(login → screen + data → journeys)"]
        DIAGNOSE["Diagnose any failures"]
        STORE["Store results & evidence"]
        DASH["Dashboard"]
    end

    DEV --> EXPLORE
    EXPLORE --> WRITE
    WRITE --> LOGIN
    LOGIN --> RUNTESTS
    RUNTESTS --> EVIDENCE
    EVIDENCE --> DIAGNOSE
    DIAGNOSE --> STORE
    STORE --> DASH
    DASH --> DEV

    style DEV fill:#dbeafe,stroke:#3b82f6
    style LOCAL fill:#eff6ff,stroke:#3b82f6
    style CLOUD fill:#f5f3ff,stroke:#8b5cf6
    style DASH fill:#dcfce7,stroke:#22c55e
```

**In short:** Healix watches an app, writes tests for it with AI, runs those
tests as different kinds of users, and then clearly explains what works, what
doesn't, and why — all from a single instruction inside the developer's coding
tool.

---

*This document describes Healix in non-technical terms. Diagrams use Mermaid and
render automatically in most Markdown viewers (GitHub, VS Code, etc.).*
