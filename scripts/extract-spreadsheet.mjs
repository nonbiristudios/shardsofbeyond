import XLSX from 'xlsx';
import fs from 'fs';
import { createHash } from 'crypto';

const hash = (content) => createHash('sha256').update(content).digest('base64');
const requiredParameters = [
    'SPREADSHEET_FILE',
    'VOTES_FOLDER',
    'CSV_FOLDER',
    'ARTWORK_FILE'
];

const sheetsToExport = [
    'Cards',
    'Artworks'
]

requiredParameters.forEach((parameter) => {
    if(process.env[parameter] === undefined) {
        throw new Error(`The environment variable "${parameter}" needs to be defined!`);
    }
});

if(!fs.existsSync(process.env.CSV_FOLDER)) {
    fs.mkdirSync(process.env.CSV_FOLDER);
}

// Export singular sheets from workbook.
XLSX.set_fs(fs);
const workbook = XLSX.readFile(process.env.SPREADSHEET_FILE);

const exportedSheets = [];
workbook.SheetNames.forEach((name) => {
    if(!sheetsToExport.includes(name)) return;

    const csvPath = `${process.env.CSV_FOLDER}/${name}.generated.csv`;
    
    fs.writeFileSync(csvPath, XLSX.utils.sheet_to_csv(workbook.Sheets[name]));
    
    console.log(`Exported sheet "${name}" to "${csvPath}"...`);
    exportedSheets.push(name);
});

if(sheetsToExport.length !== exportedSheets.length) {
    throw new Error(`Expected ${sheetsToExport.length} to be exported, but only ${exportedSheets.length} were!
    
    Expected:
    ${sheetsToExport.join('\n')}

    Exported:
    ${exportedSheets.join('\n')}`);
}

// Export card artworks.
const cards = XLSX.utils.sheet_to_json(workbook.Sheets[sheetsToExport[0]]);
// Collect all headers.
const headers = cards
    .map((card) => Object.keys(card))
    .reduce((prev, curr) => {
        curr.forEach((a) => prev.add(a));
        
        return prev;
    }, new Set());

const artworkHeaders = [...headers].filter((header) => header.toLowerCase().includes('artwork'));
console.log(`Extracting the headers "${artworkHeaders.join(', ')}" to artwork file...`);

const artworks = {};
cards.forEach((card) => {
    // We use a Set here because sometimes someones enters duplicate Job IDs...
    const artworkVariations = [...new Set(
            artworkHeaders.map((header) => card[header] ?? undefined)
                .filter((url) => url !== undefined)
        )]
        .map((url) => url.match(/^.+?jobs\/(?<id>[^\?]+)\?index=(?<index>[0-9]+)/)?.groups)
        .filter((groups) => groups !== undefined);

    if(artworkVariations.length === 0) return;
    artworks[card.Name] = {
        // The hashed Name of the card for cheaper storage.
        hashedName: hash(card.Name).substring(0, 6),
        // In order to inform the client about potential choice changes.
        checksum: hash(JSON.stringify(artworkVariations)).substring(0, 4),
        artworks: artworkVariations
            // we include a part of the sha-256 hash for easier identification of that option-
            .map((info) => {
                return {
                    ...info,
                    hash: hash(`artwork-hash-${info.id}_${info.index}`).substring(0, 5)
                }
            })
        
    };
});

console.log(`Saving extracted artwork information to "${process.env.ARTWORK_FILE}".`);
fs.writeFileSync(process.env.ARTWORK_FILE, JSON.stringify(artworks));

// Export artwork votes of each user.
const votes = XLSX.utils.sheet_to_json(workbook.Sheets[sheetsToExport[1]]);
console.log(votes);
votes.forEach((vote) => {
    const info = Buffer.from(vote['Voting Code'], 'base64');
    console.log(info.toLocaleString());
});

/*
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
*/