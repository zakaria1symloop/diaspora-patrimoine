# Deep-merges a JSON patch into a namespace file of messages/fr, keeping the order of existing keys.
#   PYTHONUTF8=1 python packages/i18n/scripts/merge-messages.py <namespace> <patch.json>
# A value `null` in the patch removes the key. Then: pnpm --filter @dp/i18n build
import json
import sys
from pathlib import Path

ns, patch_path = sys.argv[1], sys.argv[2]
target = Path(__file__).resolve().parent.parent / 'messages' / 'fr' / f'{ns}.json'
data = json.loads(target.read_text(encoding='utf-8'))
patch = json.loads(Path(patch_path).read_text(encoding='utf-8'))


def merge(into, src):
    for key, value in src.items():
        if value is None:
            into.pop(key, None)
        elif isinstance(value, dict):
            if not isinstance(into.get(key), dict):
                into[key] = {'_': into[key]} if isinstance(into.get(key), str) else {}
            merge(into[key], value)
        else:
            into[key] = value


merge(data, patch)
target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print(f'{ns}: merged {patch_path}')
