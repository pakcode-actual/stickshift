---
description: Convert existing tasks into actionable, dependency-ordered Linear issues for the feature based on available design artifacts.
tools: []
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. Run `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute.
2. From the executed script, extract the path to **tasks**.
3. You have access to a Linear MCP server. First, query the Linear API (or use the MCP tools) to find the Team ID for the "Stick Figure Storytelling" team (key: STI, ID: e105eac1-9315-491b-bba7-0bfb7ba58930).
4. For each task in the list, use the Linear MCP server (e.g. `linear_create_issue` or `create_issue`) to create a new issue in the Linear workspace. Set the title, description, and assign it to the STI team.
5. Create a parent Epic or Project in Linear for the feature if appropriate, and link the issues, OR just create them as standalone issues.

> [!CAUTION]
> Ensure all tasks are properly created in Linear and not GitHub.
