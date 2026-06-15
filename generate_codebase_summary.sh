#!/bin/bash
# generate_codebase_summary.sh
# Run this in your project root to create a codebase analysis file

echo "=== CODEBASE STRUCTURE AND ANALYSIS ===" > codebase_summary.txt
echo "Generated: $(date)" >> codebase_summary.txt
echo "" >> codebase_summary.txt

echo "## DIRECTORY STRUCTURE" >> codebase_summary.txt
echo "" >> codebase_summary.txt

# Tree view (if tree command exists, otherwise use find)
if command -v tree &> /dev/null; then
    tree -L 3 -I '__pycache__|node_modules|*.pyc|.git|venv|.env' >> codebase_summary.txt
else
    echo "### Project Structure:" >> codebase_summary.txt
    find . -type f -not -path '*/\.*' -not -path '*/node_modules/*' -not -path '*/__pycache__/*' -not -path '*/venv/*' | head -100 | sort >> codebase_summary.txt
fi

echo "" >> codebase_summary.txt
echo "" >> codebase_summary.txt
echo "## BACKEND FILES (Django)" >> codebase_summary.txt
echo "" >> codebase_summary.txt

# List backend Python files
echo "### Models" >> codebase_summary.txt
if [ -f "pos_inventory/core/models.py" ]; then
    echo "File: pos_inventory/core/models.py" >> codebase_summary.txt
    echo '```python' >> codebase_summary.txt
    head -50 pos_inventory/core/models.py >> codebase_summary.txt
    echo "...[truncated]..." >> codebase_summary.txt
    echo '```' >> codebase_summary.txt
    echo "" >> codebase_summary.txt
fi

echo "### Views" >> codebase_summary.txt
if [ -f "pos_inventory/core/views.py" ]; then
    echo "File: pos_inventory/core/views.py (first 50 lines)" >> codebase_summary.txt
    wc -l pos_inventory/core/views.py >> codebase_summary.txt
    echo "" >> codebase_summary.txt
fi

echo "### Serializers" >> codebase_summary.txt
if [ -f "pos_inventory/core/serializers.py" ]; then
    echo "File: pos_inventory/core/serializers.py (first 50 lines)" >> codebase_summary.txt
    wc -l pos_inventory/core/serializers.py >> codebase_summary.txt
    echo "" >> codebase_summary.txt
fi

echo "" >> codebase_summary.txt
echo "## FRONTEND FILES (React)" >> codebase_summary.txt
echo "" >> codebase_summary.txt

# List frontend files
if [ -d "frontend/src" ]; then
    echo "### React Components" >> codebase_summary.txt
    find frontend/src/components -name "*.jsx" 2>/dev/null | while read file; do
        echo "- $file ($(wc -l < "$file") lines)" >> codebase_summary.txt
    done
    echo "" >> codebase_summary.txt
    
    echo "### React Pages" >> codebase_summary.txt
    find frontend/src/pages -name "*.jsx" 2>/dev/null | while read file; do
        echo "- $file ($(wc -l < "$file") lines)" >> codebase_summary.txt
    done
    echo "" >> codebase_summary.txt
fi

echo "" >> codebase_summary.txt
echo "## CODE STATISTICS" >> codebase_summary.txt
echo "" >> codebase_summary.txt

echo "### Backend (Python)" >> codebase_summary.txt
find pos_inventory -name "*.py" -not -path "*/__pycache__/*" -not -path "*/migrations/*" | xargs wc -l | tail -1 >> codebase_summary.txt
echo "" >> codebase_summary.txt

echo "### Frontend (JavaScript/JSX)" >> codebase_summary.txt
find frontend/src -name "*.js" -o -name "*.jsx" 2>/dev/null | xargs wc -l | tail -1 >> codebase_summary.txt
echo "" >> codebase_summary.txt

echo "## DEPENDENCIES" >> codebase_summary.txt
echo "" >> codebase_summary.txt
echo "### Backend (Python)" >> codebase_summary.txt
if [ -f "requirements.txt" ]; then
    cat requirements.txt >> codebase_summary.txt
else
    echo "No requirements.txt found" >> codebase_summary.txt
fi
echo "" >> codebase_summary.txt

echo "### Frontend (Node)" >> codebase_summary.txt
if [ -f "frontend/package.json" ]; then
    grep -A 30 '"dependencies"' frontend/package.json >> codebase_summary.txt
else
    echo "No package.json found" >> codebase_summary.txt
fi
echo "" >> codebase_summary.txt

echo "✅ Summary generated: codebase_summary.txt"
