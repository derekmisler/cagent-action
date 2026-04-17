# PR Review Action

AI-powered pull request review using a multi-agent system. Analyzes code changes, posts inline comments, and learns from your feedback.

## Quick Start

### 1. Create the workflow

Add `.github/workflows/pr-review.yml` to your repo with this **minimal but safe setup**:

```yaml
name: PR Review
on:
  issue_comment: # Enables /review command in PR comments
    types: [created]
  pull_request_review_comment: # Captures feedback on review comments for learning
    types: [created]
  pull_request: # Triggers auto-review on PR open (same-repo branches only; fork PRs use /review)
    types: [ready_for_review, opened]

permissions:
  contents: read # Required at top-level so `issue_comment` events can read repository contents.

jobs:
  review:
    uses: docker/cagent-action/.github/workflows/review-pr.yml@VERSION
    # Scoped to the job so other jobs in this workflow aren't over-permissioned
    permissions:
      contents: read # Read repository files and PR diffs
      pull-requests: write # Post review comments and approve/request changes
      issues: write # Create security incident issues if secrets are detected in output
      checks: write # (Optional) Show review progress as a check run on the PR
      id-token: write # Required for OIDC authentication to AWS Secrets Manager
```

> **Note:** Auto-review on `pull_request` events only works for same-repo branches — fork PRs are skipped because OIDC tokens aren't available in the fork context. For fork PRs, an org member can comment `/review` to trigger a review (the `issue_comment` event runs in the base repo context where OIDC works).

### Fork PR Auto-Review

If you want automatic reviews on fork PRs, add a trigger workflow that saves the PR number via `workflow_run`:

**`.github/workflows/pr-review-trigger.yml`:**

```yaml
name: PR Review - Trigger
on:
  pull_request:
    types: [ready_for_review, opened]
jobs:
  save-pr:
    if: github.event.pull_request.head.repo.fork
    runs-on: ubuntu-latest
    steps:
      - name: Save PR number
        env:
          PR_NUMBER: ${{ github.event.pull_request.number }}
        run: printf '%s' "$PR_NUMBER" > pr_number.txt

      - name: Upload PR context
        uses: actions/upload-artifact@bbbca2ddaa5d8feaa63e36b76fdaad77386f024f # v7.0.0
        with:
          name: pr-review-context
          path: pr_number.txt
          retention-days: 1
```

Then add `workflow_run` to your main review workflow, download the artifact, and pass `pr-number` to the reusable workflow. `workflow_run` runs in the base repo context, so OIDC works:

**`.github/workflows/pr-review.yml`:**

```yaml
name: PR Review
on:
  ...
  workflow_run:
    workflows: ["PR Review - Trigger"]
    types: [completed]

jobs:
  get-pr-context:
    runs-on: ubuntu-latest
    outputs:
      pr-number: ${{ steps.pr.outputs.number }}
    steps:
      - name: Download PR context
        if: github.event_name == 'workflow_run'
        uses: actions/download-artifact@VERSION
        with:
          name: pr-review-context
          run-id: ${{ github.event.workflow_run.id }}
          github-token: ${{ github.token }}

      - name: Read PR number
        id: pr
        if: github.event_name == 'workflow_run'
        run: echo "number=$(cat pr_number.txt)" >> $GITHUB_OUTPUT
  review:
    needs: [get-pr-context]
    uses: docker/cagent-action/.github/workflows/review-pr.yml@VERSION
    with:
      pr-number: ${{ needs.get-pr-context.outputs.pr-number }}
    ...
```

### Customizing for your organization

```yaml
with:
  model: anthropic/claude-haiku-4-5 # Use a faster/cheaper model
```

### 2. That's it!

The workflow automatically handles:

| Trigger                 | Behavior                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| PR opened/ready         | Auto-reviews PRs from your org members (same-repo branches only; fork PRs use `/review`) |
| `/review` comment       | Manual review on any PR (shows as a check run on the PR if `checks: write` is granted)   |
| Reply to review comment | Responds in-thread and learns from feedback to improve future reviews                    |

> **You don't need to add fork protection guards.** The reusable workflow has built-in defense-in-depth — you don't need to add `if:` conditions like `github.event.pull_request.head.repo.full_name == github.repository` or `author_association` checks to your caller workflow. The reusable workflow already:
>
> 1. **Skips fork PRs** on `pull_request` events (`head.repo == base.repo` check)
> 2. **Fails gracefully** when OIDC tokens are unavailable (fork context) — no credentials are fetched
> 3. **Verifies org membership** before every review (auto-review checks the PR author; `/review` checks the commenter)
>
> Adding redundant guards at the caller level can actually break `/review` and feedback capture, since `issue_comment` and `pull_request_review_comment` events don't have `pull_request.head.repo` context.

---

## Running Locally

Requires [Docker Agent](https://github.com/docker/docker-agent) installed locally. The reviewer agent automatically detects its environment. When running locally, it diffs your current branch against the base branch and outputs findings to the console.

```bash
cd ~/code/my-project
docker agent run agentcatalog/review-pr "Review my changes"
```

The agent automatically:

- Pulls the latest version from Docker Hub
- Reads `AGENTS.md` or `CLAUDE.md` from your repo root for project-specific context (language versions, conventions, etc.)
- Diffs your current branch against the base branch
- Outputs the review as formatted markdown

> **Tip:** Docker Agent has a TUI, so you can interact with the agent during the review — ask follow-up questions, request clarification on findings, or drill into specific files.

### Project Context via `AGENTS.md`

The reviewer automatically looks for an `AGENTS.md` (or `CLAUDE.md`) file in your repository root before analyzing code. This file is read and passed to all sub-agents (drafter and verifier), so project-specific context like language versions, build tools, and coding conventions are respected during the review.

For example, if your `AGENTS.md` says "Look at go.mod for the Go version," the reviewer will check `go.mod` before flagging APIs as nonexistent — avoiding false positives from newer language features.

No workflow configuration is needed — just commit an `AGENTS.md` to your repo root.

You can also pass additional files explicitly with `--prompt-file`:

```bash
docker agent run agentcatalog/review-pr --prompt-file CONTRIBUTING.md "Review my changes"
```

---

## Advanced: Using the Composite Action Directly

For more control over the workflow, use the composite action instead of the reusable workflow:

```yaml
name: PR Review

on:
  issue_comment:
    types: [created]

permissions:
  contents: read # Read repository files and PR diffs
  pull-requests: write # Post review comments and approve/request changes
  issues: write # Create security incident issues if secrets are detected in output
  checks: write # (Optional) Show review progress as a check run on the PR
  id-token: write # Required for OIDC authentication to AWS Secrets Manager

jobs:
  review:
    if: github.event.issue.pull_request && startsWith(github.event.comment.body, '/review')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ref: refs/pull/${{ github.event.issue.number }}/head

      - uses: docker/cagent-action/review-pr@VERSION
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          github-token: ${{ github.token }}
```

> **Note:** When using the composite action directly, learning from feedback is handled automatically — the review action collects and processes any pending feedback artifacts before each review. However, to _capture_ that feedback, use the reusable workflow which includes the `capture-feedback` job, or add the equivalent artifact upload step to your own workflow.

---

## Adding Project-Specific Guidelines

The recommended approach is to add an `AGENTS.md` file to your repository root. The reviewer automatically reads it before every review — no workflow changes needed. This is ideal for project conventions, language versions, and coding standards that should always apply.

For workflow-level overrides or guidelines that apply across multiple repos, use the `additional-prompt` input:

```yaml
- uses: docker/cagent-action/review-pr@VERSION
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    additional-prompt: |
      ## Go Patterns
      - Flag missing `if err != nil` error handling
      - Check for `interface{}` without type assertions
      - Verify context.Context is passed through calls
```

```yaml
- uses: docker/cagent-action/review-pr@VERSION
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    additional-prompt: |
      ## TypeScript Patterns
      - Flag any use of `any` type
      - Check for missing null/undefined checks
      - Verify async functions have try/catch
```

```yaml
# Project-specific conventions
- uses: docker/cagent-action/review-pr@VERSION
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    additional-prompt: |
      ## Project Conventions
      - We use `zod` for validation - flag manual type checks
      - Database queries must use the `db.transaction()` wrapper
      - All API handlers should use `withErrorHandling()` HOF
      - Prefer `date-fns` over native Date methods
```

---

## Using a Different Model

The default model is **Claude Sonnet 4.5** (`anthropic/claude-sonnet-4-5`), which balances quality and cost.

Override for more thorough or cost-effective reviews:

```yaml
# Anthropic (default provider)
- uses: docker/cagent-action/review-pr@VERSION
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    model: anthropic/claude-opus-4 # More thorough reviews
```

```yaml
# OpenAI Codex
- uses: docker/cagent-action/review-pr@VERSION
  with:
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
    model: openai/codex-mini
```

```yaml
# Google Gemini
- uses: docker/cagent-action/review-pr@VERSION
  with:
    google-api-key: ${{ secrets.GOOGLE_API_KEY }}
    model: gemini/gemini-2.0-flash
```

```yaml
# xAI Grok
- uses: docker/cagent-action/review-pr@VERSION
  with:
    xai-api-key: ${{ secrets.XAI_API_KEY }}
    model: xai/grok-2
```

---

## Inputs

### Reusable Workflow

When using `docker/cagent-action/.github/workflows/review-pr.yml`:

| Input               | Description                                         | Default |
| ------------------- | --------------------------------------------------- | ------- |
| `pr-number`         | PR number (auto-detected from event)                | -       |
| `comment-id`        | Comment ID for reactions (auto-detected)            | -       |
| `additional-prompt` | Additional review guidelines                        | -       |
| `model`             | Model override (e.g., `anthropic/claude-haiku-4-5`) | -       |
| `add-prompt-files`  | Comma-separated files to append to the prompt       | -       |

### `review-pr` (Composite Action)

PR number and comment ID are auto-detected from `github.event` when not provided.

> **API Keys:** Provide at least one API key for your preferred provider. You don't need all of them.

| Input                      | Description                                                      | Required |
| -------------------------- | ---------------------------------------------------------------- | -------- |
| `pr-number`                | PR number (auto-detected)                                        | No       |
| `comment-id`               | Comment ID for reactions (auto-detected)                         | No       |
| `additional-prompt`        | Additional review guidelines (appended to built-in instructions) | No       |
| `model`                    | Model override (default: `anthropic/claude-sonnet-4-5`)          | No       |
| `anthropic-api-key`        | Anthropic API key                                                | No\*     |
| `openai-api-key`           | OpenAI API key                                                   | No\*     |
| `google-api-key`           | Google API key (Gemini)                                          | No\*     |
| `aws-bearer-token-bedrock` | AWS Bedrock token                                                | No\*     |
| `xai-api-key`              | xAI API key (Grok)                                               | No\*     |
| `nebius-api-key`           | Nebius API key                                                   | No\*     |
| `mistral-api-key`          | Mistral API key                                                  | No\*     |
| `github-token`             | GitHub token                                                     | No       |
| `github-app-id`            | GitHub App ID for custom identity                                | No       |
| `github-app-private-key`   | GitHub App private key                                           | No       |
| `add-prompt-files`         | Comma-separated files to append to the prompt                    | No       |

\*API keys are optional when using the reusable workflow (credentials are fetched via OIDC). Only required when using the composite action directly without OIDC.

---

## Cost

The action uses **Claude Sonnet 4.5** by default. Typical costs per review:

| PR Size             | Estimated Cost |
| ------------------- | -------------- |
| Small (1-5 files)   | ~$0.02-0.05    |
| Medium (5-15 files) | ~$0.05-0.15    |
| Large (15+ files)   | ~$0.15-0.50    |

Costs depend on diff size, not just file count. To reduce costs:

- Use `model: anthropic/claude-haiku-4-5` for faster, cheaper reviews
- Trigger reviews selectively (not on every push)

---

## Example Output

When issues are found, the action posts inline review comments:

```markdown
**Potential null pointer dereference**

The `user` variable could be `nil` here if `GetUser()` returns an error,
but the error check happens after this line accesses `user.ID`.

Consider moving the nil check before accessing user properties.

<!-- cagent-review -->
```

When no issues are found:

```markdown
✅ Looks good! No issues found in the changed code.
```

---

## Progress Indicators

### Check Runs

When the workflow has `checks: write` permission, reviews appear as check runs on the PR's Checks tab. This makes it easy to see review status at a glance — `in_progress` while reviewing, then `success`, `failure`, or `cancelled` when done. If `checks: write` is not granted, the workflow still works normally without check runs.

### Reactions

The action also uses emoji reactions on your `/review` comment to indicate progress:

| Stage             | Reaction | Meaning                        |
| ----------------- | -------- | ------------------------------ |
| Started           | 👀       | Review in progress             |
| Approved          | 👍       | PR looks good, no issues found |
| Changes requested | _(none)_ | Review posted with feedback    |
| Error             | 😕       | Something went wrong           |

---

## How It Works

### Review Pipeline

```
AGENTS.md + PR Diff → Drafter (hypotheses) → Verifier (confirm) → Post Comments
```

### Learning System

When you reply to a review comment, two things happen in parallel:

**Synchronous reply** (`reply-to-feedback` job):

1. Checks if the reply is to an agent comment (via `<!-- cagent-review -->` marker)
2. Verifies the author is an org member/collaborator (authorization gate)
3. Builds the full thread context (original comment + all replies in chronological order)
4. Runs a Sonnet-powered reply agent that posts a contextual response in the same thread
5. The agent also stores learnings in the memory database for future reviews

**Async artifact capture** (`capture-feedback` job):

1. Saves the feedback as a GitHub Actions artifact (no secrets required)
2. On the next review run, pending feedback artifacts are downloaded and processed into the memory database
3. Acts as a resilient fallback if the reply agent fails or isn't configured

This dual approach means the developer gets an immediate conversational response while also ensuring learnings are captured even if the reply job encounters an issue.

### Conversational Replies

The reviewer supports true multi-turn conversation in PR review threads. When you reply to a review comment:

- **Ask a question** — the agent explains its reasoning, references specific code, and offers suggestions
- **Correct a false positive** — the agent acknowledges the mistake and remembers it for future reviews
- **Disagree** — the agent engages thoughtfully, discusses trade-offs, and considers your perspective
- **Add context** — the agent thanks you, reassesses its finding, and stores the insight

Agent replies are marked with `<!-- cagent-review-reply -->` (distinct from `<!-- cagent-review -->` on original review comments) to prevent infinite loops. Multi-turn threading works automatically because GitHub's `in_reply_to_id` always points to the root comment.

**Memory persistence:** The memory database is stored in GitHub Actions cache. Each review run restores the previous cache, processes any pending feedback, runs the review, and saves with a unique key. Old caches are automatically cleaned up (keeping the 5 most recent).

---

## Running Evals

Evals verify that the reviewer produces consistent, correct results across multiple runs.

### Run all evals

```bash
cd cagent-action
docker agent eval review-pr/agents/pr-review.yaml review-pr/agents/evals/ \
  -e GITHUB_TOKEN -e GH_TOKEN
```

### Eval structure

Each eval file in `review-pr/agents/evals/` contains:

- **`messages`**: The initial user prompt (e.g., a PR URL)
- **`evals.relevance`**: Natural-language assertions checked against the agent's output
- **`evals.setup`**: Setup commands run before the eval (e.g., installing `gh`)

### Eval naming conventions

| Prefix       | Expected outcome                                                   |
| ------------ | ------------------------------------------------------------------ |
| `success-*`  | Clean PR, agent should APPROVE                                     |
| `security-*` | PR with security concerns, agent should COMMENT or REQUEST_CHANGES |

### Writing new evals

1. Find a PR with a known correct outcome (e.g., a clean PR that should be approved, or one with a real bug)
2. Create a JSON file with the PR URL as the user message and relevance criteria describing the expected behavior
3. Run the eval 3+ times to verify consistency

```json
{
  "id": "unique-uuid",
  "title": "Description of what this eval tests",
  "evals": {
    "setup": "apk add --no-cache github-cli",
    "relevance": [
      "The agent ran 'echo $GITHUB_ACTIONS' before performing the review to detect the output mode",
      "The agent output the review to the console as formatted markdown instead of posting via gh api",
      "The drafter response is valid JSON containing a 'findings' array and a 'summary' field",
      "... assertions about the expected findings and verdict ..."
    ]
  },
  "messages": [
    {
      "message": {
        "agentName": "",
        "message": {
          "role": "user",
          "content": "https://github.com/org/repo/pull/123",
          "created_at": "2026-01-01T00:00:00-05:00"
        }
      }
    }
  ]
}
```

> **Tip:** Create multiple eval files for the same PR to test consistency. If the agent produces different verdicts across runs, the failing evals highlight the inconsistency.

---

## What It Reviews

**Catches:** Logic errors, null dereferences, resource leaks, security issues, error handling mistakes, concurrency bugs

**Context-aware:** Reads `AGENTS.md`/`CLAUDE.md` for project conventions and checks build files (e.g., `go.mod`, `package.json`) to validate findings against the project's actual toolchain version.

**Ignores:** Style, formatting, documentation, test files, unchanged code

## Troubleshooting

**Review ran but no comments appeared?**

- Check the workflow summary - it should say "Review posted successfully"
- The agent always posts a review (approval or comments). If you see 👍 reaction, the PR was approved
- Look at the PR's "Files changed" tab → "Viewed" dropdown to see review comments

**No reaction on my `/review` comment?**

- Ensure the workflow has `pull-requests: write` permission
- Check if the `github-token` has access to react to comments

**No check run showing on the PR?**

- Add `checks: write` to your workflow permissions (it's optional — the review works without it)
- Check runs are created for manual (`/review`) triggers. Auto-reviews from `pull_request` already appear as workflow runs natively

**Learning doesn't seem to work?**

- You must **reply directly** to an agent comment (use the reply button, not a new comment)
- The agent detects its own comments via the `<!-- cagent-review -->` marker
- Check Actions → Caches to verify `pr-review-memory-*` exists

**Reviews are too slow?**

- Large diffs take longer. Consider reviewing smaller PRs
- Use `model: anthropic/claude-haiku-4-5` for faster (but less thorough) reviews

**Clear the memory cache:** Actions → Caches → Delete `pr-review-memory-*`
