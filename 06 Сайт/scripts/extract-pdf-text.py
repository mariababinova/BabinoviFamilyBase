import sys

import fitz


def main():
    if len(sys.argv) < 2:
        return 2
    doc = fitz.open(sys.argv[1])
    parts = []
    for page in doc:
        parts.append(page.get_text())
    sys.stdout.write("\n".join(parts))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
