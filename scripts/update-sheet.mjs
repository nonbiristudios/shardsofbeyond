import { createHash } from 'crypto';
import fs from 'fs';

const hash = (content) => createHash('sha-256').update(content).digest('hex');
const requiredParameters = [
    'SPREADSHEET_FILE',
    'GOOGLE_SHEET_URL'
];

requiredParameters.forEach((parameter) => {
    if(process.env[parameter] === undefined) {
        throw new Error(`The environment variable "${parameter}" needs to be defined!`);
    }
});

// Download the current sheet.
const remoteSheet = await fetch(process.env.GOOGLE_SHEET_URL);
const content = new Uint8Array(await remoteSheet.arrayBuffer());
const newHash = hash(content);

console.log(`Hash of remote sheet: ${newHash} (${content.length})`);

// Calculate hash of current file.
const currentSheet = new Uint8Array(fs.existsSync(process.env.SPREADSHEET_FILE)
    ? fs.readFileSync(process.env.SPREADSHEET_FILE)
    : new Uint8Array());
const oldHash = hash(currentSheet);

console.log(`Hash of current sheet: ${oldHash} (${currentSheet.length})`);

if(newHash === oldHash) {
    console.log('Hashes are identical, nothing to update...');
    process.exit(0);
}

console.log('Hashes divert. Updating old sheet...');

fs.writeFileSync(process.env.SPREADSHEET_FILE, content);