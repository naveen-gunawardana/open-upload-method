"""Entry point for the packaged OQM app (double-click to open the interface)."""

import sys

from oqm.cli import main

if __name__ == "__main__":
    sys.exit(main(["ui", *sys.argv[1:]]))
