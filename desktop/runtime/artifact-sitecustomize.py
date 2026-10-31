"""Offer pinned authoring libraries after a project's own Python dependencies."""
from pathlib import Path
import sys

_sylvana_artifact_libraries=str(Path(__file__).resolve().parent.parent)
if _sylvana_artifact_libraries not in sys.path:
    sys.path.append(_sylvana_artifact_libraries)
