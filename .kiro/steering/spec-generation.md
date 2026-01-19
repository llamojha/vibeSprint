---
inclusion: manual
---

# Spec Generation Guide - VibeSprint

Use this guide to generate Kiro specs from your MVP roadmap.

## Quick Start

**To generate a spec, copy this prompt and replace [FEATURE_NAME]:**

```
Create a new spec for "[FEATURE_NAME]" based on the roadmap at #[[file:.kiro/roadmap.md]].

Use the PRD at #[[file:PRD.md]] for product context and the architecture at #[[file:.kiro/steering/architecture.md]] for technical guidance.

Generate three files in .kiro/specs/[feature-slug]/:
1. requirements.md - User story and acceptance criteria
2. design.md - Technical approach and component design
3. tasks.md - Implementation checklist
```

## Spec Structure

```
.kiro/specs/[feature-name]/
├── requirements.md   # What to build
├── design.md         # How to build it
└── tasks.md          # Implementation checklist
```

## Key References

- PRD: `PRD.md`
- Roadmap: `.kiro/roadmap.md`
- Architecture: `.kiro/steering/architecture.md`
- Workflow: `.kiro/steering/workflow-conventions.md`
- Overview: `.kiro/steering/project-overview.md`

## Tips

1. Generate specs in roadmap phase order
2. Review before implementing
3. Reference existing code for consistency
4. Keep tasks small and focused
