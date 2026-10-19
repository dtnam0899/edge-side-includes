"""Start the esi-agents image with a scripted model for the end-to-end scenario (phase 5).

No model provider is chosen yet (ADR-0001), so the real image answers every generation with
``model-unavailable``. This launcher keeps everything in the image real (prompts, SQL policy, schema
grounding, DSL validation, retries, HTTP contract) and replaces only the model: each prompt is matched
against the rules in ``ESI_E2E_MODEL_FIXTURES`` and the rule's output is returned as the model answer.
A prompt no rule matches gets an answer the agents must reject, so a scenario never passes by accident.

Run inside the image: ``python /e2e/fixture_model.py``. Replace with the real provider once its ADR lands.
"""

import json
import logging
import os
import re

import uvicorn
from esi_agents.app import create_app
from esi_agents.config import get_settings

log = logging.getLogger("e2e.fixture_model")

# The part of each prompt a rule is matched against: the question for SQL (the history above it holds
# earlier questions), the columns and intent for DSL.
_SECTIONS = {
    "sql": re.compile(r"\nQUESTION\n(?P<text>.*)\Z", re.DOTALL),
    "dsl": re.compile(r"\nCOLUMNS \(name: SQL Server type\)\n(?P<text>.*)\Z", re.DOTALL),
}


class FixtureModel:
    """Answers prompts from fixture rules: ``{"operation", "contains": [...], "output"}``."""

    def __init__(self, rules: list[dict]) -> None:
        self._rules = rules
        self.calls = 0

    async def complete(self, prompt: str) -> str:
        self.calls += 1
        for operation, pattern in _SECTIONS.items():
            match = pattern.search(prompt)
            if match is None:
                continue
            text = match.group("text").lower()
            for rule in self._rules:
                if rule["operation"] == operation and all(
                    needle.lower() in text for needle in rule["contains"]
                ):
                    log.info("fixture rule %s answered a %s prompt", rule["id"], operation)
                    return json.dumps(rule["output"])
            log.warning("no fixture rule matched a %s prompt", operation)
            return "no fixture rule matched"
        log.warning("prompt of unknown shape")
        return "no fixture rule matched"


def main() -> None:
    settings = get_settings()
    with open(os.environ["ESI_E2E_MODEL_FIXTURES"], encoding="utf-8") as fixtures:
        rules = json.load(fixtures)["rules"]
    app = create_app(model=FixtureModel(rules), settings=settings)
    uvicorn.run(app, host=settings.host, port=settings.port, log_level=settings.log_level.lower())


if __name__ == "__main__":
    main()
