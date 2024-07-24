TEMP_PATH="${TEMP_PATH:=./temp.xlsx}"
CURRENT_SHEET_PATH="${CURRENT_SHEET_PATH:=./card-data/beyond.xlsx}"

if [[ -z "$GOOGLE_SHEET_URL" ]]; then
    echo "Error: GOOGLE_SHEET_URL is not set!"
    exit 1
fi

curl -sL "$GOOGLE_SHEET_URL" -o "$TEMP_PATH"
REMOTE_HASH="sha256sum '$TEMP_PATH' | awk '{print $1}'"

if [[ -f "$CURRENT_SHEET_PATH" ]]; then
    LOCAL_HASH="sha256sum '$CURRENT_SHEET_PATH' | awk '{print $1}'"
else
    LOCAL_HASH=""
fi

if [[ "$REMOTE_HASH" != "$LOCAL_HASH" ]]; then
    mv "$TEMP_PATH" "$CURRENT_SHEET_PATH"
    echo "Updated workflow sheet!"
else
    echo "No updates in sheet detected."
    rm "$TEMP_PATH"
fi