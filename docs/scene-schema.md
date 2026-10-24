# Scene contract

Status: not implemented; M1. The illustrative JSON in `implement.md` is not yet an accepted runtime contract. Do not treat arbitrary JSON as a renderable scene.

M1 will introduce schemaVersion 1 with strict Zod objects, stable IDs, allowlisted object/material/light/animation variants, bounded finite numbers and semantic checks. Initial limits follow the specification: 100 objects, 20 lights, 200 tracks, duration 0.1–300 seconds, positions ±10,000, positive scale 0.01–100, strict colors and bounded particles up to 5,000. Validate duplicate IDs, parent cycles/references and approved local assets. Runtime consumes only validated scenes.

M5 adds strict revision-bound patches, validated before and after application. Schema updates require pure migrations, preserving valid data and stable IDs. Fill in exact field contracts and supported types alongside M1 implementation and tests.
