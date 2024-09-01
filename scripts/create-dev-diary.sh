COMMIT_HASHES=$(git log -n 2 --pretty=format:"%H" --follow $CARDS_FILE)

PREVIOUS_COMMIT=$(echo "$COMMIT_HASHES" | tail -n 1)
LATEST_COMMIT=$(echo "$COMMIT_HASHES" | head -n 1)

# DIFF=$(git diff --color --word-diff=plain $LATEST_COMMIT..$PREVIOUS_COMMIT $CARDS_FILE)
# echo $DIFF
git show $LATEST_COMMIT:$CARDS_FILE