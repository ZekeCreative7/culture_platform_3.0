#!/bin/bash
# Double-click this file to commit and push the current workspace state.

cd "$(dirname "$0")" || exit 1

echo "Culture Platform 3.0 commit launcher"
echo "------------------------------------"
echo ""

if ! command -v git >/dev/null 2>&1; then
  echo "Git is not installed or not available in PATH."
  echo "Press any key to close."
  read -n 1 -s
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This folder is not a Git repository."
  echo "Press any key to close."
  read -n 1 -s
  exit 1
fi

echo "Checking changed files..."
git status --short
echo ""

if [ -z "$(git status --porcelain)" ]; then
  echo "No changes to commit."
  echo "Press any key to close."
  read -n 1 -s
  exit 0
fi

COMMIT_MESSAGE="Update Culture Platform $(date '+%Y-%m-%d %H:%M:%S')"

echo "Adding changed files..."
git add -A

echo "Creating commit:"
echo "$COMMIT_MESSAGE"
git commit -m "$COMMIT_MESSAGE"
COMMIT_EXIT=$?

if [ $COMMIT_EXIT -ne 0 ]; then
  echo ""
  echo "Commit failed. Check the message above."
  echo "Press any key to close."
  read -n 1 -s
  exit $COMMIT_EXIT
fi

echo ""
echo "Pushing to GitHub..."
git push
PUSH_EXIT=$?

echo ""
if [ $PUSH_EXIT -eq 0 ]; then
  echo "Done. Changes were committed and pushed to GitHub."
else
  echo "Push failed. Check login/network status and try again."
fi

echo "Press any key to close."
read -n 1 -s
exit $PUSH_EXIT
