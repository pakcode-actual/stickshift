# Project Context

## Product Type
Interactive scrollytelling platform with an autonomous animated stick figure character.

## Domain
Rive animation engine (character rendering + state machines), DOM text layout (Pretext), scroll-driven orchestration (GSAP ScrollTrigger), environmental physics (Rapier.js for props only).

## Stakeholders
- **Decision maker:** Paul
- **Downstream consumers:** Spec Kit. Once a feature is approved, Strata should output a Product Brief that can be directly used as the input for a `/speckit.specify` command.

## Downstream Workflow
Strata evaluates ideas → Paul approves → Strata writes Product Brief → Spec Kit generates tasks → Linear Agent creates tickets → Cyrus builds it.

## Domain-Specific Evaluation Criteria
- **Character personality:** Does this feature make the stick figure feel more alive, quirky, or funny?
- **Pipeline autonomy:** Does this reduce Paul's intervention count? Can it be tested without him?
- **Animation authoring:** Is animation created in Rive's visual editor, not hand-coded?
