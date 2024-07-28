CURRENT_ARTWORKS_JSON="${CURRENT_ARTWORKS_JSON:=./card-data/card-artworks.generated.json}"
WEBSITE_FOLDER="${WEBSITE_FOLDER:=./art-voting-tool}"

if [[ -z "$CURRENT_ARTWORKS_JSON" ]]; then
    echo "Error: JSON file with generated artworks does not exist!"
    exit 1
fi

cp "$CURRENT_ARTWORKS_JSON" "$WEBSITE_FOLDER/artworks.json"