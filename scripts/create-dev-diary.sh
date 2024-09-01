COMMIT_HASHES=$(git log -n 2 --follow --pretty=format:"%H" -- $CARDS_FILE)

PREVIOUS_COMMIT=$(echo "$COMMIT_HASHES" | tail -n 1)
LATEST_COMMIT=$(echo "$COMMIT_HASHES" | head -n 1)

DIFF=$(git diff $LATEST_COMMIT..$PREVIOUS_COMMIT $CARDS_FILE)
echo $DIFF
echo $CARDS_FILE