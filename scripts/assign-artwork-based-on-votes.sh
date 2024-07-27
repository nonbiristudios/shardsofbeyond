#!/bin/bash
DATA_FOLDER="${TARGET_FOLDER:=./card-data}"
VOTE_TARGET_FOLDER=${VOTE_TARGET_FOLDER:=./card-data/votes}

TEMP_FOLDER="temp"

if [ ! -d "$TEMP_FOLDER" ]; then
    mkdir $TEMP_FOLDER
fi

TEMP_TXT_FILES=()
for json_file in "$VOTE_TARGET_FOLDER"/*.vote.json; do
    temp_txt_file="$TEMP_FOLDER/$(basename "$json_file" .vote.json).txt"
    echo "Reading file \"$json_file\" into \"$temp_txt_file\" ..."

    jq -r 'to_entries | .[] | "\(.key) \(.value | to_entries | .[])"' "$json_file" > "$temp_txt_file"
    
    TEMP_TXT_FILES+=("$temp_txt_file")
done

# Use awk to find the lowest index for each ID
awk '
{
  if (match($0, /([^{]+) {"key":"([0-9]+)","value":"([^"]+)"}/, arr)) {
    card = arr[1]
    place = arr[2]
    id = arr[3]

    cards[card, id] = cards[card, id] + (3-place)
    total_cards[card] = 1
  }
}
END {
  printf "{\n"
  first = 1

  for (card in total_cards) {
    best_value = 0
    best_artwork = "none"

    for(entry in cards) {
      split(entry, parts, SUBSEP)

      name = parts[1]
      artwork = parts[2]

      if(name == card) {
        if(best_artwork == "none") {
          best_artwork = name
        }

        if(cards[name, artwork] > best_value) {
          best_value = cards[name, artwork]
          best_artwork = artwork
        }
      }
    }

    if(first == 1) {
      first = 0
    } else {
      printf ","
    }

    printf "\t\"%s\": \"%s\"\n", card, best_artwork
  }

  printf "}"
}
' "${TEMP_TXT_FILES[@]}" > "$TEMP_FOLDER/artworks.txt"

# Clean up temporary files
mv "$TEMP_FOLDER/artworks.txt" "$DATA_FOLDER/voted-artworks.json"
rm -r "$TEMP_FOLDER"