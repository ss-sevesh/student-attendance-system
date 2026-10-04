\# Student Registration Prototype



\## Summary



Build one Next.js application with TypeScript, responsive styling, SQLite persistence, local OCR, and a server-side Playwright service.



Deliver the complete flow: sign up/login → dashboard → upload ID card → review OCR → enter Lineways credentials → fetch student information → compare sources → review and save profile.



\## Implementation



1\. \*\*Accounts and dashboard\*\*

&#x20;  - Use email/password accounts, hashed passwords, and database-backed sessions with HttpOnly cookies.

&#x20;  - Build signup, login, logout, and protected dashboard pages.

&#x20;  - Show a prominent \*\*Register Student\*\* button and the latest saved profile.

&#x20;  - Use one SQLite database for users, sessions, and reviewed profiles.

2\. \*\*ID-card extraction\*\*

&#x20;  - Accept JPEG, PNG, and WebP images up to 10 MB; display a preview and extraction progress.

&#x20;  - Use Sharp for image preprocessing and Tesseract.js for actual OCR, without external API credentials.

&#x20;  - Parse labeled text into name, student ID, department, program, birth date, year, email, phone, and additional detected fields.

&#x20;  - Preserve raw OCR text for review. Leave uncertain or absent values empty instead of guessing.

&#x20;  - Process images temporarily and discard them after extraction. Allow replacement and retry.

3\. \*\*Lineways integration\*\*

&#x20;  - Create an isolated server-side Playwright service targeting the \[provided login page](<https://kec.linways.com/ams/student/login>).

&#x20;  - Start with the observed username/password inputs and \*\*Sign in\*\* button. Keep URLs, selectors, authenticated-page detection, and field mappings in one configuration module.

&#x20;  - During implementation, use the supplied credentials transiently to inspect authenticated navigation and configure the actual student information page.

&#x20;  - Launch a fresh browser context per request, submit the login form, confirm authentication, navigate to the profile, and extract visible student information.

&#x20;  - Close the context in all outcomes. Never persist credentials, browser sessions, request bodies, traces, or authenticated screenshots.

&#x20;  - Clear the password field after submission. Return clear errors for invalid credentials, timeouts, changed selectors, CAPTCHA, and MFA; stop at security challenges.

&#x20;  - If authenticated access cannot be completed, retain the configurable integration and show its actual status. Never substitute mock data in the student flow.

4\. \*\*Combine, review, and save\*\*

&#x20;  - Represent each field with both source values, comparison status, and a separately stored reviewed value.

&#x20;  - Compare trimmed, case-normalized text; normalize unambiguous dates and phone formatting. Preserve original values and leading zeros in student IDs.

&#x20;  - Show matching values normally. Show conflicts side by side with \*\*Needs verification\*\*, requiring a source selection or manual correction before saving.

&#x20;  - Group results into personal, academic, contact, and additional information.

&#x20;  - Display truthful source statuses: successful, failed, or unavailable. Permit retry or explicit continuation with a partial profile.

&#x20;  - Save the latest reviewed profile with source provenance and corrections; reopen it from the dashboard.



\## Interfaces and Error Handling



\- Authentication endpoints: signup, login, logout.

\- Protected registration endpoints: multipart OCR upload, transient Lineways credential submission, profile retrieval, and reviewed-profile save.

\- Both extraction services return a common result containing source, status, fields, additional fields, and safe error details.

\- Guard all protected routes and profile access by session ownership.

\- Use loading states, disabled duplicate submissions, accessible forms, mobile layouts, and actionable error messages.

\- Keep everything in one local Node.js application; no queues, containers, or additional services.



\## Verification



\- Test account creation, duplicate email handling, invalid login, logout, and protected-route access.

\- Verify real OCR using a clearly labeled synthetic ID-card image; cover missing fields, unsupported files, and unreadable images.

\- Test Playwright against a local fixture portal for login, profile extraction, rejected credentials, timeout, and security-challenge handling. Fixture data stays outside the real integration.

\- Verify matching fields, conflicting values, missing values, corrections, partial profiles, save, reload, and account isolation.

\- Run browser checks on desktop and mobile, followed by build and type checks.

\- Verify the real Lineways flow when accessible; document any external blocker separately from fixture test results.



\## Assumptions and Delivery



\- Start from the inspected empty repository; run locally on the available Node.js installation using `npm.cmd`.

\- English OCR is the initial default. No email verification, password reset, or administrative portal is required.

\- Persist accounts and reviewed profiles, but not uploaded images or Lineways credentials.

\- Provide a README covering setup, Chromium installation, OCR assets, configuration, commands, and verified integration status.

