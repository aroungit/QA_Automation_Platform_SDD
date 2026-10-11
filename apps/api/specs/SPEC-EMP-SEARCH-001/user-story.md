# User Story: PIM Employee Search by Name and Employment Status

**Spec ID:** SPEC-EMP-SEARCH-001  
**Target Application:** OrangeHRM  
**Platform:** mobile  
**Priority:** high  
**Created:** 2026-10-11T03:25:50.552Z  
**Updated:** 2026-10-11T03:25:50.552Z  

## Story Description

As an HR Manager, I want to search and filter employees in the PIM module by their full name, employee ID, and employment status so that I can quickly access individual profiles and verify contract types.

## Acceptance Criteria

1. Entering a partial or full name in the "Employee Name" autocomplete field suggests matching active records.
2. Selecting "Full-Time Contract" filter displays only employees currently engaged under full-time contracts.
3. Clicking "Search" populates the results data table with employee ID, first name, last name, and job title.
4. Clicking "Reset" clears all search parameters and reloads the default paginated employee list.
5. Searching for a non-existent identifier displays a "No Records Found" empty state indicator.
