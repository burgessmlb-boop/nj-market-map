"""One-command data refresh: download -> scores (all levels) -> pulse -> validate."""

import sys

import config
import download
import scores
import validate


def main() -> None:
    force = "--force" in sys.argv
    levels = [a for a in sys.argv[1:] if a in config.LEVELS]
    download.main(force=force)
    scores.main(levels or None)
    try:
        import redfin

        redfin.main()
    except ImportError:
        pass  # pulse module added in a later phase
    except Exception as e:
        # The weekly pulse must never block the monthly map refresh.
        print(f"WARNING: pulse build failed ({e}); keeping previous pulse.json")
    validate.main()


if __name__ == "__main__":
    main()
