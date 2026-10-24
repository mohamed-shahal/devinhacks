# Export

Status: not implemented; M7. No export controls claim to produce an artifact in M0.

Planned formats are validated scene JSON, project ZIP with scene/metadata/local assets/README/attribution and supported standalone HTML with bundled runtime. Standalone export must use pinned dependencies and no remote scripts by default. Large assets use relative files in ZIP; limitations and any HTTP-serving requirement must be explicit. Unavailable formats are disabled with a reason.

Before reporting success, validate scene/assets, produce the artifact, inspect contents for secrets/private configuration and smoke-test independently from the development server. Missing assets fail clearly. License/attribution data accompanies third-party assets and runtime dependencies. Exact format/version/size limits will be documented with M7.
