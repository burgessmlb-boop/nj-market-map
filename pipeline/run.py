"""One-command data refresh: download -> scores -> validate."""

import sys

import download
import scores
import validate


def main() -> None:
    force = "--force" in sys.argv
    download.main(force=force)
    scores.main()
    validate.main()


if __name__ == "__main__":
    main()
