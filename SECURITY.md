# Security Policy

## Supported versions

Security fixes are released for the latest published version of `@lamberl-lee/file-preview`. Upgrade to the current npm release before reporting an issue that may already be fixed.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Use [GitHub private vulnerability reporting](https://github.com/CoderLambert/filevista/security/advisories/new) and include:

- the affected FileVista version;
- the preview format and source type involved;
- a minimal reproduction or sample file, with sensitive data removed;
- the expected and observed behavior;
- the potential impact and any known workaround.

You should receive an acknowledgement within seven days. Please allow time for validation and a coordinated release before publishing details.

## Security model

FileVista renders files in the browser and does not upload them to a FileVista server. Applications integrating the library are still responsible for source authorization, CORS policy, content security policy, safe handling of untrusted URLs, and user confirmation before enabling trusted HTML preview.
