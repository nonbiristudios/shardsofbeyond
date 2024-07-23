CURRENT_SHEET_PATH="${CURRENT_SHEET_PATH:=./card-data/beyond.xlsx}"
TARGET_FOLDER="${TARGET_FOLDER:=./card-data}"
TEMP_FILE_NAME="beyond.txt"

if [[ -z "$CURRENT_SHEET_PATH" ]]; then
    echo "Error: Sheet path does not exist!"
    exit 1
fi

ssconvert --export-file-per-sheet -O "quoting-mode='always'" "./card-data/beyond.xlsx" $TEMP_FILE_NAME

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
            printf "\t],\n"
        }
    }
    END {
        # Close the JSON object
        print "}"
    }
' $TEMP_FILE_NAME.0 > $TARGET_FOLDER/card-artworks.generated.json

rm $TEMP_FILE_NAME.*