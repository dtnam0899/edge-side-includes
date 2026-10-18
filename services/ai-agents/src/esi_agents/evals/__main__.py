"""CLI: ``python -m esi_agents.evals [PATH]``. Exit 1 if a case fails, 2 if no cases."""

import argparse
import asyncio
import sys
from pathlib import Path

from esi_agents.evals.runner import load_cases, run_cases
from esi_agents.llm.stub import StubModel


def main(argv: list[str] | None = None) -> int:
    """Run the evals with the deterministic stub model and print one line per case."""
    parser = argparse.ArgumentParser(prog="python -m esi_agents.evals")
    parser.add_argument("path", nargs="?", default="evals/cases", type=Path)
    args = parser.parse_args(argv)

    cases = load_cases(args.path)
    if not cases:
        print(f"no cases found in {args.path}")
        return 2
    model = StubModel({case.prompt: case.stub_output for case in cases})
    results = asyncio.run(run_cases(cases, model))
    for result in results:
        status = "PASS" if result.passed else "FAIL"
        detail = "".join(f"\n    {c.kind} {c.path}: {c.value!r}" for c in result.failed_checks)
        print(f"{status} {result.id}{detail}")
    failed = sum(not r.passed for r in results)
    print(f"{len(results) - failed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
