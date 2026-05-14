.PHONY: release-patch release-version

PYTHON ?= python3
VERSION ?=
NEXT_PATCH = $(shell $(PYTHON) -c 'import json; v=json.load(open("package.json"))["version"].split("."); print(f"{v[0]}.{v[1]}.{int(v[2])+1}")')

release-patch:
	$(MAKE) release-version VERSION=$(NEXT_PATCH)

release-version:
	@test -n "$(VERSION)" || (echo "Usage: make release-version VERSION=x.y.z" && exit 1)
	@printf "Bump package versions to $(VERSION)? [y/N] "; read confirm; case "$$confirm" in y|Y|yes|YES) ;; *) echo "Aborted"; exit 1 ;; esac
	$(PYTHON) -c 'import json, re; from pathlib import Path; version = "$(VERSION)"; p = Path("pyproject.toml"); p.write_text(re.sub(r"^version = \".*\"$$", f"version = \"{version}\"", p.read_text(), count=1, flags=re.M)); paths = [Path("package.json"), Path("packages/js/package.json")]; [path.write_text(json.dumps({**json.loads(path.read_text()), "version": version}, indent=2) + "\n") for path in paths]; lock = Path("package-lock.json"); data = json.loads(lock.read_text()); data["version"] = version; data["packages"][""]["version"] = version; data["packages"].get("packages/js", {})["version"] = version; lock.write_text(json.dumps(data, indent=2) + "\n")'
	@echo "Updated package versions to $(VERSION). Commit these changes, then tag with: git tag v$(VERSION)"
