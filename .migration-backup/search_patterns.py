import re
import os

patterns = [
    r'TODO', r'FIXME', r'XXX', r'stub', r'mock', r'placeholder'
]
regex = re.compile('|'.join(patterns), re.IGNORECASE)

def search_files(directory):
    for root, dirs, files in os.walk(directory):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if '.git' in dirs:
            dirs.remove('.git')
        for file in files:
            if file.endswith(('.ts', '.tsx', '.js', '.jsx')):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        for i, line in enumerate(f, 1):
                            if regex.search(line):
                                # Filter out common UI placeholders
                                if 'placeholder=' in line or 'placeholder:' in line or 'data-[placeholder]' in line:
                                    continue
                                # Filter out imports of mockData
                                if 'import' in line and 'mockData' in line:
                                    continue
                                print(f"{path}:{i}:{line.strip()}")
                except Exception:
                    pass

print("--- SERVER ---")
search_files('server')
print("\n--- CLIENT ---")
search_files('client')
