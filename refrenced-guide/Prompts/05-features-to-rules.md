# Prompt 05 — Features to Rules (Coding Constitution)

> **Phase 2 — Define** · Step 4 of 4
> **Run in:** IDE agent (Copilot / Cursor / Claude Code) — **new chat**
> **Inputs:** `PRD.md`, `FEATURES.md`
> **Output:** Project rules file — saved as your agent's instruction file (see Steps)

## When to use

After the feature list is locked. The rules file is the "coding constitution":
standards and constraints that every AI coding session must follow for the rest of
the project. It is the most-read document in the whole pipeline — every later prompt
tells the agent to obey it.

## The prompt

```text
You are an expert software architect and technical lead tasked with creating a
comprehensive development rules file based on the attached Product Requirements
Document (PRD) #PRD.md and features list #FEATURES.md .

Create a clear, structured rules file that establishes technical and general
guidelines for AI assistance during the development process. These rules will
ensure consistency, quality, and alignment with project requirements.

If any critical information is missing or unclear, ask specific questions before
proceeding.

Generate the rules by:

1. TECHNOLOGY STACK DEFINITION:
   - Identify core technologies mentioned or implied in the PRD/features
   - Specify the latest stable versions for each technology
   - Define required libraries, frameworks, or tools

2. TECHNICAL PREFERENCES:
   - Naming conventions for files, components, variables, etc.
   - Code organization principles (folder structure, modularity)
   - Architectural patterns to follow
   - Standards for data handling, state management, and API interactions
   - Performance optimization strategies
   - Security practices and requirements

3. DEVELOPMENT STANDARDS:
   - Testing requirements and coverage expectations
   - Error handling and logging requirements
   - Accessibility standards
   - Responsive design requirements

4. IMPLEMENTATION PRIORITIES:
   - Core features vs. enhancements (MoSCoW)
   - Phased implementation approach
   - Quality thresholds that must be met

5. GENERAL GUIDELINES:
   - Rules for following requirements precisely
   - Expectations for code quality, readability, and maintainability
   - Standards for completeness (no TODOs or placeholders)
   - How to handle uncertainty or ambiguity

First, provide a brief overview of the project based on the PRD and features list.
Then create the rules content. Ensure the rules are specific enough to guide
development but flexible enough to allow for creative problem-solving.
```

## Steps

1. Open a **new** chat.
2. Paste the prompt and attach `PRD.md` and `FEATURES.md`.
3. Answer any clarifying questions, then review the generated rules.
4. **Save the rules as your AI agent's instruction file** so it is loaded
   automatically in every session:

   | Your tool | Save rules to |
   |-----------|---------------|
   | VS Code + Copilot | `.github/copilot-instructions.md` |
   | Cursor | `.cursorrules` (or `.cursor/rules/`) |
   | Claude Code | `CLAUDE.md` |
   | Tool-agnostic (recommended in addition) | `AGENTS.md` |

   In Nexus-CRM, the rules live in `.github/copilot-instructions.md` with `AGENTS.md`
   alongside it, so any agent picks them up.

## Done when

- [ ] Rules file saved as your agent's instruction file (not just a loose `RULES.md`)
- [ ] It names the stack, folder structure, testing bar, and security rules
- [ ] Committed to git
