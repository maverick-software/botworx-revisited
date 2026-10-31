# Sylvana

Sylvana is a Windows desktop AI workspace with local conversation and document storage. The hosted Sylvana dashboard manages sign-in, law firm membership, desktop authorizations, and shared usage budgets.

The installed development application is 0.46.3. Standard and Max use the Sylvana VPS provider, with server-enforced model assignments, zero-data-retention routing, firm membership and usage accounting. Legal Compliance requires managed routing. When disabled, the firm's AI service selection can authorize ChatGPT OAuth or API connections; saved credentials remain protected locally.

The public download remains 0.46.1. Its inspected payload lacks the current desktop policy protocol and cannot complete current managed account verification. A qualified compatible installer is required before new-client rollout.

- [Windows installation, account linking, and local data](README/sylvana-desktop.md)
- [Hosted dashboard](https://sylvana-legal-web-app.vercel.app)
- [Complete Windows installer](https://sylvana-legal-web-app.vercel.app/api/download)
- [Separate dashboard repository](https://github.com/maverick-software/sylvana-legal-web-app)

The active desktop checkout is `F:\Sylvana\desktop`. The dashboard source is `D:\Users\charl\software\sylanva-legal-web-app`. Build and verification output stays on F:.

## Development

Use the pinned dependencies and Node.js 24. Run `npm ci`, `npm run desktop:typecheck`, and `npm run desktop:build`. Package through `npm run desktop:make`, with `SYLVANA_STAGE_DIR` pointing to a fresh folder on F:. The packaged application requires the declared runtime dependencies, including the YAML skill reader. Preserve credential, profile, and runtime bindings when installing an upgrade.

See [current verification and operating limits](docs/desktop/provider-platform-hardening.md) for the queue, completed agent work, billing checks, context reporting and remaining release gates. Version-specific documents describe their experiment's source and runtime.
