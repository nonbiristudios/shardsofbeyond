import XLSX from 'xlsx';
import fs from 'fs';
import { createHash } from 'crypto';

const hash = (content) => createHash('sha256').update(content).digest('base64');
const requiredParameters = [
    'SPREADSHEET_FILE',
    'VOTES_FOLDER',
    'CSV_FOLDER',
    'ARTWORK_FILE',
    'ARTWORK_VOTING_TOOL_FOLDER',
    'VOTED_ARTWORKS_FILE',
    'ARTWORKS_FOLDER',
    'NON_EXISTING_ARTWORKS_INFO_FILE'
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

// Copy artworks to artwork-voting-tool.
fs.copyFileSync(process.env.ARTWORK_FILE, `${process.env.ARTWORK_VOTING_TOOL_FOLDER}/artworks.generated.json`);

// Export artwork votes of each user.
const votes = XLSX.utils.sheet_to_json(workbook.Sheets[sheetsToExport[1]]);
console.log(votes);
votes.forEach((vote) => {
    const info = Buffer.from(vote['Voting Code'] ?? '', 'base64');
    if(info.length === 0) return;

    const path = `${process.env.VOTES_FOLDER}/${vote['Name']}.generated.json`;

    console.log(`Writing votes of user "${vote['Name']}" to "${path}"...`);

    // Export single votes to votes folder.
    fs.writeFileSync(path, info);
});

// Combine all votes so far into a single file.
const allRatings = {};
const voteFiles = fs.readdirSync(process.env.VOTES_FOLDER);
    voteFiles
        .map((path) => fs.readFileSync(`${process.env.VOTES_FOLDER}/${path}`, {encoding: 'utf-8'}))
        .map((content) => JSON.parse(content))
        //Update the ratings for every #Card
        .forEach((content) => {
            Object.entries(content).forEach(([cardhash, ratings]) => {
                Object.entries(ratings)
                    // Only the "rankings" are important here, not the checksum or something else
                    .filter(([key, value]) => !isNaN(parseFloat(key)))
                    .forEach(([key, value]) => {
                        console.log(cardhash, key, value);
                        allRatings[cardhash] = allRatings[cardhash] ?? {};
                        // 3 - key because we invertedly weight the medals
                        allRatings[cardhash][value] = (allRatings[cardhash][value] ?? 0) + (3-key)
                    })
            })
        });

const finalizedRatings = {};

// We convert all the compressed data back to "real" values.
Object.entries(allRatings)
    .forEach(([cardhash, ratings]) => {
        // Find card that the current hash belongs to.
        const currentCard = Object.keys(artworks).find((name) => artworks[name].hashedName === cardhash);
        // Calculate the artwork with the highest ratings.
        finalizedRatings[currentCard] = Object.entries(ratings)
            .reduce((prev, curr) => {
                console.log(prev, curr);
                if(curr[1] >= prev.votes) {
                    return {
                        votes: curr[1],
                        art: curr[0]
                    }
                }

                return prev;

            }, {votes: 0, art: ""})
            .art;

        let artwork;
        Object.values(artworks).find((card) => artwork = card.artworks.find((artwork) => artwork.hash === finalizedRatings[currentCard]));
        
        // Map object to fake URL.
        finalizedRatings[currentCard] = `${artwork.id}_${artwork.index}.png`;
    });

fs.writeFileSync(process.env.VOTED_ARTWORKS_FILE, JSON.stringify(finalizedRatings));

// Export a list of all artworks that have not been downloaded yet.
const nonExistingArtworks = [];
Object.values(artworks).forEach((artwork) => artwork.artworks.forEach((artwork) => {
    const combinedUrl = `${artwork.id}_${artwork.index}.png`;
    
    if(!fs.existsSync(`${process.env.ARTWORKS_FOLDER}/all/${combinedUrl}`)) {
        nonExistingArtworks.push({url: `https://cdn.midjourney.com/${artwork.id}/0_${artwork.index}.png`, path: combinedUrl});
    }
}))

fs.writeFileSync(process.env.NON_EXISTING_ARTWORKS_INFO_FILE, nonExistingArtworks
    .map((info) => `${info.url} --save as--> ${info.path}`)
    .join('\n')
);