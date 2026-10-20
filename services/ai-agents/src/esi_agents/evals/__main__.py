"""CLI: ``python -m esi_agents.evals [PATH] [--model gemini]``. Exit 1 if a case fails, 2 if none.

Without ``--model`` the cases run against the deterministic stub (CI). ``--model gemini`` runs the
agent cases that have ``real_checks`` against the Gemini API (ADR-0007): by hand only, never in CI,
with ``ESI_AGENTS_GEMINI_API_KEY`` set and the demo limits unless overridden in the environment.
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

from esi_agents.config import Settings
from esi_agents.evals.runner import CaseResult, load_cases, run_cases, run_real_cases
from esi_agents.llm.gemini import GeminiModel
from esi_agents.llm.stub import StubModel
from esi_agents.prompts import DSL_GENERATION, SQL_GENERATION

# The demo values from ADR-0007 / infra/azure/README.md; an ESI_AGENTS_* variable overrides each.
DEMO_LIMITS = {
    "request_deadline_seconds": 50.0,
    "model_timeout_seconds": 25.0,
    "model_retries": 1,
    "sql_max_retries": 1,
    "dsl_max_retries": 1,
}


def _real_settings() -> Settings:
    limits = {k: v for k, v in DEMO_LIMITS.items() if f"ESI_AGENTS_{k.upper()}" not in os.environ}
    return Settings(model_provider="gemini", **limits)


async def _run_gemini(path: Path, settings: Settings) -> list[CaseResult]:
    model = GeminiModel(settings)
    try:
        return await run_real_cases(load_cases(path), model, settings)
    finally:
        await model.aclose()


def _print(results: list[CaseResult], timing: bool = False) -> int:
    for result in results:
        status = "PASS" if result.passed else "FAIL"
        calls = f" ({result.model_calls} calls, {result.seconds:.1f}s)" if timing else ""
        detail = "".join(f"\n    {c.kind} {c.path}: {c.value!r}" for c in result.failed_checks)
        print(f"{status} {result.id}{calls}{detail}")
    failed = sum(not r.passed for r in results)
    print(f"{len(results) - failed} passed, {failed} failed")
    return 1 if failed else 0


def main(argv: list[str] | None = None) -> int:
    """Run the evals and print one line per case."""
    parser = argparse.ArgumentParser(prog="python -m esi_agents.evals")
    parser.add_argument("path", nargs="?", default="evals/cases", type=Path)
    parser.add_argument("--model", choices=["stub", "gemini"], default="stub")
    args = parser.parse_args(argv)

    if args.model == "gemini":
        settings = _real_settings()
        results = asyncio.run(_run_gemini(args.path, settings))
        if not results:
            print(f"no cases with real_checks found in {args.path}")
            return 2
        print(
            f"model {settings.gemini_model} (thinking {settings.gemini_thinking_level}), "
            f"prompts {SQL_GENERATION} {DSL_GENERATION}, "
            f"deadline {settings.request_deadline_seconds:g}s, "
            f"retries sql {settings.sql_max_retries} dsl {settings.dsl_max_retries}"
        )
        code = _print(results, timing=True)
        print(
            f"model calls {sum(r.model_calls for r in results)}, "
            f"slowest request {max(r.seconds for r in results):.1f}s"
        )
        return code

    cases = load_cases(args.path)
    if not cases:
        print(f"no cases found in {args.path}")
        return 2
    model = StubModel({case.prompt: case.stub_output for case in cases})
    return _print(asyncio.run(run_cases(cases, model)))


if __name__ == "__main__":
    sys.exit(main())
