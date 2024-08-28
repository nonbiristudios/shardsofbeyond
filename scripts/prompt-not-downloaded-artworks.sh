CURRENT_ARTWORKS_JSON="${CURRENT_ARTWORKS_JSON:=./card-data/card-artworks.generated.json}"
CARD_DATA_FOLDER="${CARD_DATA_FOLDER:=./card-data}"
ALL_CARD_DATA_FOLDER="${ALL_CARD_DATA_FOLDER:=./artworks/all}"

artworks=$(jq -r '.[][] | "\(.id)_\(.index)"' $CURRENT_ARTWORKS_JSON)

missing_file="$CARD_DATA_FOLDER/missing-artworks.generated.txt"
rm -f "$missing_file"
touch "$missing_file"

for artwork in $artworks; do
  if [ ${#artwork} > 3 ]; then
    IFS='_' read -ra parts <<< "$artwork"

    artwork_path="${parts[0]}_${parts[1]}.png"
  
    path="$ALL_CARD_DATA_FOLDER/$artwork_path"

    if [ ! -f "$path" ]; then
      echo "$artwork_path --- https://cdn.midjourney.com/${parts[0]}/0_${parts[1]}.png" >> "$missing_file"
    fi
  fi
done