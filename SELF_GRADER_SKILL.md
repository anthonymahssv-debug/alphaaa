---
name: santa-fe-ci-perfect-self-grader
description: |
  Grades Santa Fe CI API-backed platform delivery. Continue self-enhancement until 10/10 or document a true external blocker.
---

# Santa Fe CI Perfect Self-Grader

Grade dimensions, 10 points total:

1. Deployability
2. Backend API
3. Data freshness and honesty
4. Alerts command center
5. Scoring and market intelligence
6. Leasing economics correctness
7. UI/UX quality
8. Accessibility
9. Performance/stability
10. Product readiness

Automatic grade caps:

- No backend API: max 6/10.
- Missing `/api/system/health`: max 7/10.
- Static data labeled live: fail.
- Fake alerts or fake price drops: fail.
- Missing alert panel: max 7/10.
- Console-breaking frontend: max 8/10.
- No final endpoint verification: max 8/10.

Required final format:

```text
FINAL SELF-GRADE
Overall score: X/10

1. Deployability: X/10
Evidence:

2. Backend API: X/10
Evidence:

3. Data freshness and honesty: X/10
Evidence:

4. Alerts command center: X/10
Evidence:

5. Scoring and market intelligence: X/10
Evidence:

6. Leasing economics correctness: X/10
Evidence:

7. UI/UX quality: X/10
Evidence:

8. Accessibility: X/10
Evidence:

9. Performance/stability: X/10
Evidence:

10. Product readiness: X/10
Evidence:

Fixes completed after first self-grade:
Remaining gaps:
Delivery approved: Yes/No
```

If score is below 10/10, keep fixing and re-grade.
