# Changelog

## GradeShelf v1.3.0 - Flexible grading and course half-years

GradeShelf 1.3.0 adds flexible grading and course half-years while keeping simple grade lists easy to use.

### Grades and course half-years

- Use simple grades, school-year halves or four course half-years, with separate grading scales in the same account.
- Set up subjects, course types, enrollment and shared weighting together, with optional exceptions per subject.
- Use percentage weighting, grouped assessments, decimal and tendency grades, and a target-grade calculator.
- Track received final grades separately from calculated averages. Exports and calendar entries include the relevant periods and groups.

### Updating

For regular installations, back up and update:

```sh
sh scripts/backup.sh && docker compose pull && docker compose up -d --wait
```

Keep `.env` and `data/`; migrations preserve existing data. For pinned installations, use `ghcr.io/14flavius/gradeshelf:1.3.0`.

Customized v1.2.0 installations must use the [import procedure](README.md#import-a-customized-installation) first. Accounts and attachments are retained; review any unassigned periods or types afterwards.

### Thanks

Thanks to [Denis (@Denis5C)](https://github.com/Denis5C) for the suggestions and shared implementation that helped shape the school and upper-secondary features.
