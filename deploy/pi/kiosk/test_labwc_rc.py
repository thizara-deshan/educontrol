"""Tests for labwc_rc.py (PLAN-M10). Run: python3 -m unittest discover -s deploy/pi/kiosk"""

import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

import labwc_rc

SCRIPT = Path(__file__).with_name("labwc_rc.py")
NS = "{http://openbox.org/3.4/rc}"
USER_RC = """<?xml version="1.0" encoding="UTF-8"?>
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <!-- written by the desktop settings -->
  <theme><name>PiXnoir</name></theme>
  <keyboard><keybind key="W-t"><action name="Execute" command="lxterminal" /></keybind></keyboard>
</openbox_config>
"""


def rules(text: str) -> list[ET.Element]:
    root = ET.fromstring(text)
    ns = NS if root.tag.startswith("{") else ""
    return [r for r in root.iter(f"{ns}windowRule") if r.get("identifier") == "chromium*"]


class AddRuleTest(unittest.TestCase):
    def test_adds_warp_and_hide_to_an_empty_config(self) -> None:
        updated = labwc_rc.add_rule(labwc_rc.EMPTY_RC)
        assert updated is not None
        (rule,) = rules(updated)
        actions = [(a.get("name"), a.get("x"), a.get("y")) for a in rule.iter(f"{NS}action")]
        self.assertEqual(actions, [("WarpCursor", "-1", "-1"), ("HideCursor", None, None)])

    def test_keeps_existing_settings_and_comments(self) -> None:
        updated = labwc_rc.add_rule(USER_RC)
        assert updated is not None
        self.assertIn("<name>PiXnoir</name>", updated)
        self.assertIn('command="lxterminal"', updated)
        self.assertIn("<!-- written by the desktop settings -->", updated)
        self.assertNotIn("ns0:", updated)
        self.assertEqual(len(rules(updated)), 1)

    def test_is_idempotent(self) -> None:
        once = labwc_rc.add_rule(USER_RC)
        assert once is not None
        self.assertIsNone(labwc_rc.add_rule(once))

    def test_reuses_an_existing_window_rules_block(self) -> None:
        text = USER_RC.replace(
            "</openbox_config>",
            '<windowRules><windowRule identifier="pcmanfm" serverDecoration="no" /></windowRules>\n</openbox_config>',
        )
        updated = labwc_rc.add_rule(text)
        assert updated is not None
        root = ET.fromstring(updated)
        self.assertEqual(len(root.findall(f"{NS}windowRules")), 1)
        self.assertEqual(len(root.findall(f"{NS}windowRules/{NS}windowRule")), 2)

    def test_accepts_a_config_without_namespace(self) -> None:
        updated = labwc_rc.add_rule("<openbox_config><theme /></openbox_config>")
        assert updated is not None
        self.assertEqual(len(rules(updated)), 1)

    def test_rejects_other_xml(self) -> None:
        with self.assertRaises(ValueError):
            labwc_rc.add_rule("<menu />")


class CliTest(unittest.TestCase):
    def run_cli(self, path: Path) -> str:
        done = subprocess.run([sys.executable, str(SCRIPT), str(path)], capture_output=True, text=True, check=True)
        return done.stdout.strip()

    def test_creates_a_missing_file_then_leaves_it_alone(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "labwc" / "rc.xml"
            self.assertEqual(self.run_cli(path), "added")
            first = path.read_bytes()
            self.assertEqual(self.run_cli(path), "unchanged")
            self.assertEqual(path.read_bytes(), first)


if __name__ == "__main__":
    unittest.main()
