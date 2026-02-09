import re

# Limpar popup.js
with open('scripts/popup.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Remover linhas de comentário decorativos
content = re.sub(r'\/\/\s*═.*?\n', '', content)
# Remover comentários de seção
content = re.sub(r'^\s*\/\/\s*[A-Z][A-Z ]+\n', '', content, flags=re.MULTILINE)
# Remover emojis
emoji_pattern = re.compile("["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map symbols
        "]+", flags=re.UNICODE)
content = emoji_pattern.sub(r'', content)

with open('scripts/popup.js', 'w', encoding='utf-8') as f:
    f.write(content)

# Limpar background.js
with open('scripts/background.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'\/\/\s*═.*?\n', '', content)
content = re.sub(r'^\s*\/\/\s*[A-Z][A-Z ]+\n', '', content, flags=re.MULTILINE)
content = emoji_pattern.sub(r'', content)

with open('scripts/background.js', 'w', encoding='utf-8') as f:
    f.write(content)

# Limpar popup.html
with open('popup.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = emoji_pattern.sub(r'', content)
content = re.sub(r'<!-- [^-]*? -->\n', '', content)

with open('popup.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("OK - Limpeza concluida!")
