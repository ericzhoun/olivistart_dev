# Consolidate Programs Into Homepage Design

**Date:** 2026-07-16

## Goal

Make `index.html` the single destination for OliVista's program information. Move the complete Programs page content into the homepage, update links to target the homepage section, and remove `programs.html`.

## Page Structure

The homepage keeps its existing hero at the top. The current condensed "We Offer" teaser is replaced by one Programs area with the `programs` anchor. That area contains, in order:

1. Combine the age-to-program mapping table, with the program introduction
2. The existing philosophy teaser and call-to-action
3. The full Visual Discovery section.
4. The full Young Photographer Camp section.
5. The full Creative Foundations section.
6. The full Portfolio Studio section.


## Navigation and Links

Every site navigation link labeled Programs will point to `index.html#programs`. Program links within the homepage will use local section anchors such as `#visual-discovery`. Links from schedules and other pages that currently target `programs.html` will also point to the new homepage destination.

The Home navigation item remains active on `index.html`. The Programs section does not introduce a second active navigation state.

## Content Preservation

The move preserves all content currently in `programs.html`, including the uncommitted image update for Visual Discovery and the four-program age mapping. Existing program-specific classes and section IDs remain intact so the current styling continues to apply.

## File Removal and Compatibility

Delete `programs.html` after all references have been migrated. No redirect file will remain, as requested. Historical documentation may continue to mention the old file because it records prior designs and plans; current HTML, JavaScript, and automated page checks must not depend on it.

## Verification

Verification will cover:

- Automated tests and repository checks.
- A search confirming that active site files no longer link to `programs.html`.
- Homepage loading and anchor navigation for Programs and each program section.
- Desktop and mobile visual inspection, with particular attention to section spacing, navigation behavior, image layout, and accidental content duplication.
- Confirmation that deleting `programs.html` does not leave it in the automated page list.
