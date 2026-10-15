#!/usr/bin/env python3
"""Adds the Eduscope kiosk window rule to a labwc rc.xml (PLAN-M10 D6).

When a Chromium window maps, labwc moves the pointer to the bottom-right corner and hides it; it
reappears only on mouse movement, so a touch-only kiosk never shows a cursor. Raspberry Pi OS starts
labwc with --merge-config, so this user file only carries our rule and the system rc.xml still
applies. Idempotent: a file that already has the rule is not rewritten.

Usage: labwc_rc.py PATH   (prints "added" or "unchanged")
"""

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

OPENBOX_NS = "http://openbox.org/3.4/rc"
RULE_IDENTIFIER = "chromium*"
ACTIONS: tuple[tuple[str, dict[str, str]], ...] = (
    ("WarpCursor", {"to": "output", "x": "-1", "y": "-1"}),
    ("HideCursor", {}),
)
EMPTY_RC = f'<?xml version="1.0" encoding="UTF-8"?>\n<openbox_config xmlns="{OPENBOX_NS}">\n</openbox_config>\n'


def _namespace(root: ET.Element) -> str:
    """'{uri}' when the root element is namespaced, else ''."""
    return root.tag[: root.tag.index("}") + 1] if root.tag.startswith("{") else ""


def has_rule(root: ET.Element) -> bool:
    ns = _namespace(root)
    for rule in root.iter(f"{ns}windowRule"):
        names = {action.get("name") for action in rule.iter(f"{ns}action")}
        if rule.get("identifier") == RULE_IDENTIFIER and "HideCursor" in names:
            return True
    return False


def add_rule(text: str) -> str | None:
    """The new file content, or None when the rule is already there."""
    ET.register_namespace("", OPENBOX_NS)
    parser = ET.XMLParser(target=ET.TreeBuilder(insert_comments=True))
    root = ET.fromstring(text, parser=parser)
    ns = _namespace(root)
    if root.tag != f"{ns}openbox_config":
        raise ValueError(f"not a labwc rc.xml: root element is {root.tag}")
    if has_rule(root):
        return None
    rules = root.find(f"{ns}windowRules")
    if rules is None:
        rules = ET.SubElement(root, f"{ns}windowRules")
    rule = ET.SubElement(rules, f"{ns}windowRule", {"identifier": RULE_IDENTIFIER})
    for name, attributes in ACTIONS:
        ET.SubElement(rule, f"{ns}action", {"name": name, **attributes})
    ET.indent(root, space="  ")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode") + "\n"


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: labwc_rc.py PATH", file=sys.stderr)
        return 2
    path = Path(argv[1])
    current = path.read_text(encoding="utf-8") if path.exists() else EMPTY_RC
    updated = add_rule(current)
    if updated is None:
        print("unchanged")
        return 0
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(updated, encoding="utf-8")
    print("added")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
