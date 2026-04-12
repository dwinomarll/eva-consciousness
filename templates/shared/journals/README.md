# Journals

Dated session logs — one file per day you work in this playground.
The spawn CLI auto-creates today's entry from `_template.md`.

For new sessions after spawn:
```bash
DATE=$(date +%Y-%m-%d)
cp journals/_template.md journals/$DATE.md
sed -i '' "s/{{DATE}}/$DATE/g" journals/$DATE.md   # macOS
# sed -i "s/{{DATE}}/$DATE/g" journals/$DATE.md    # Linux
```
