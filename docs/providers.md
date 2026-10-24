# Providers

Status: no provider adapter, credential vault, model catalog or routing implemented. Credential entry is disabled in the UI. Do not enter provider keys into frontend code or `.env` for M0. No live provider has been tested or is advertised as supported.

M3 first implements hosted security and one real adapter. Models remain configurable; a model name does not establish capability. All five task assignments require enabled, eligible connections/models. Unknown capabilities are unsupported. Fallback is off unless explicitly enabled and eligible. Connection tests report credential acceptance separately from task support, with latency and sanitized errors.

| Provider                                  | Status                      | Capabilities verified       |
| ----------------------------------------- | --------------------------- | --------------------------- |
| OpenAI                                    | Planned first adapter in M3 | None yet                    |
| Anthropic / Gemini / compatible endpoints | Deferred P1                 | None                        |
| Local deterministic templates             | Planned M4 demo mode        | No LLM capabilities claimed |

Setup, credential format, supported parameters, rotation and manual smoke-test instructions will be added with tested implementation. Default automated tests use mocked network responses and require no paid calls.
