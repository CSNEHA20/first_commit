"""
PolicyLab Entity Provider Domain Models
Defines interfaces and fixture loaders for Cedar authorization entity graphs.
"""

from abc import ABC, abstractmethod
import json
from pathlib import Path
from typing import Any, Dict, List, Optional


class IEntityProvider(ABC):
    """Abstract interface for retrieving Cedar entity graphs."""

    @abstractmethod
    def get_entities(self) -> List[Dict[str, Any]]:
        """Returns the list of entity records formatted for Cedar WASM engine."""
        pass


class FixtureEntityProvider(IEntityProvider):
    """
    Loads deterministic entity graph fixtures from JSON definitions or memory.
    """

    def __init__(self, entities: Optional[List[Dict[str, Any]]] = None, fixture_path: Optional[str] = None):
        self._entities: List[Dict[str, Any]] = []
        if entities is not None:
            self._entities = entities
        elif fixture_path:
            path = Path(fixture_path)
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    self._entities = json.load(f)

    def get_entities(self) -> List[Dict[str, Any]]:
        return self._entities
