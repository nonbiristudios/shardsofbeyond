CURRENT_SHEET_PATH="${CURRENT_SHEET_PATH:=./card-data/beyond.xlsx}"
TARGET_FOLDER="${TARGET_FOLDER:=./card-data}"
VOTE_TARGET_FOLDER=${VOTE_TARGET_FOLDER:=./card-data/votes}
TEMP_FILE_NAME="beyond.txt"
CARD_SHEET_INDEX=0
VOTE_SHEET_INDEX=1

if [[ -z "$CURRENT_SHEET_PATH" ]]; then
    echo "Error: Sheet path does not exist!"
    exit 1
fi

if [ ! -d "$VOTE_TARGET_FOLDER" ]; then
    mkdir $VOTE_TARGET_FOLDER
fi

ssconvert --export-file-per-sheet -O "quoting-mode='always'" "./card-data/beyond.xlsx" $TEMP_FILE_NAME

# Export Card-Artworks-URL.
awk -F, '
    BEGIN {
        # Initialize JSON object
        print "{"
        first = 1
        FS = "\",\""
    }
    NR == 1 {
        # Find the indices of the required columns
        $0 = substr($0, 2, length($0) - 2)
        for (i = 1; i <= NF; i++) {
            if ($i == "Name") name_idx = i
            if ($i == "Artwork 1") art_start_idx = i
            if ($i == "Artwork 10") art_end_idx = i
        }
    }
    NR > 1 {
        $0 = substr($0, 2, length($0) - 2)
        if ($name_idx != "") {
        
            # Comma Separation only on the 2nd element forwards
            if (NR > 2) {
                printf ","
            }
        
            # Print the name and artwork array as JSON
            printf "\t\"%s\": [\n", $name_idx
            
            for (i = art_start_idx; i <= art_end_idx; i++) {

                # Convert Job-URL to Image-URL
                if (match($i, /^.+?jobs\/([^\?]+)\?index=([0-9]+)/, arr)) {
                    id = arr[1]
                    indix = arr[2]

                    if (i > art_start_idx) {
                        printf "\t\t,"
                    } else {
                        printf "\t\t"
                    }
                    printf "{\"id\": \"%s\", \"index\":\"%s\"}\n", id, indix
                }
            }
            printf "\t]\n"
        }
    }
    END {
        # Close the JSON object
        print "}"
    }
' $TEMP_FILE_NAME.$CARD_SHEET_INDEX > $TARGET_FOLDER/card-artworks.generated.json

# Export Votes for every User as JSON.
awk -F, '
    BEGIN {
        # Initialize JSON object
        FS = "\",\""
    }
    NR > 1 && NR <= 10 {
        $0 = substr($0, 2, length($0) - 2)
        # Extract column B and column A values
        if($2 != "") {
            colA = $1
            colB = $2

            # Prepare the output filename
            output_filename = colA ".vote.json"

            # Base64 decode column B content
            "echo " colB " | base64 --decode" | getline decoded_content

            # Write the decoded content to the output file
            print decoded_content > output_filename
        }
    }
' $TEMP_FILE_NAME.$VOTE_SHEET_INDEX > $TEMP_FILE_NAME.trash

mv *.vote.json "$VOTE_TARGET_FOLDER"
mv $TEMP_FILE_NAME.0 "$TARGET_FOLDER/cards.csv"

rm $TEMP_FILE_NAME.*