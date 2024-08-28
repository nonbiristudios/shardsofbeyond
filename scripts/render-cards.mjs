"use strict";

import path from 'path';

import fs from 'fs';
import svgConvert from 'convert-svg-to-png';
import csv from 'csv-parser';

const { createConverter } = svgConvert;

const requiredParameters = [
    'CARDS_FILE',
    'ARTWORKS_FOLDER',
    'TEMPLATE_FOLDER',
    'EXPORT_FOLDER',
    'CARD_RENDER_TEMPLATE',
    'DATA_FOLDER',
    'VOTED_ARTWORKS',
    'EXPORT_IMAGE_FOLDER'
];

requiredParameters.forEach((parameter) => {
    if(process.env[parameter] === undefined) {
        throw new Error(`The environment variable "${parameter}" needs to be defined!`);
    }
});

// Folder definitions.
const votedArtworkFile = process.env.VOTED_ARTWORKS
const cardFilePath = process.env.CARDS_FILE
const artworkFolder = process.env.ARTWORKS_FOLDER
const templateFolder = process.env.TEMPLATE_FOLDER
const exportFolder = process.env.EXPORT_FOLDER
const cardLayout = process.env.CARD_RENDER_TEMPLATE

const createFolderIfNotExists = (dir) => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
};

const loadCSVData = async (filePath) => {
    const results = [];
  
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          resolve(results);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
};  

const generateSVGTemplate = (card, svgCode, templates) => {
    const getFunctionArguments = (func) => {
        const funcString = func.toString();
        const argList = funcString.match(/\((.*?)\)/);
        if (!argList)
            return [];
        return argList[1].split(',')
            .map(arg => arg.trim())
            .filter(str => str.length > 0);
    };
    const evaluateFunctions = (code, card) => {
        const regex = /\{\{(?<jscode>.*?)\}\}(?:[^\}]|$){1}/gs;
        const functionDefinitions = [];
        let match;
        while (!!(match = regex.exec(code))) {
            functionDefinitions.push(match.groups['jscode']);
        }
        if (!functionDefinitions)
            return code;

        functionDefinitions.forEach(definition => {
            let interpolationFunction;
            try {
                interpolationFunction = eval(definition);
            }
            catch (e) {
                throw new Error(`The following function is not valid: ${definition}`);
            }
            const interpolationArguments = getFunctionArguments(interpolationFunction);
            const args = interpolationArguments.map(arg => card[arg] || null);
            try {
                const value = interpolationFunction.apply(null, args);
                code = code.replace(`{{${definition}}}`, value);
            }
            catch (e) {
                throw new Error(`Error while trying to execute the function "${interpolationFunction.toString()}": ${e}`);
            }
        });
        return code;
    };

    return evaluateFunctions(svgCode, { card: card, explanations: explanations, templates: templates});
};

const explanations = {
    Ally: (type) => `When this gets deployed, put an Ally Token on this. Whenever a ${type} is deployed adjacently or this is deployed adjacently to a friendly ${type}, do something and remove this Token.`,
    Ambush: "You may deploy this face-down. At the end of each Turn, if the Condition got fulfilled and you fulfil the Crystal Requirements, you may unearth this.",
    Bury: null,
    Choose_one: null,
    Cleanse: "Remove all Tokens and the Card Text from a Unit.",
    Ritual: "When you deploy this, you may bury an adjacent friendly Unit to do something.",
    Crystallize: "Something turns into a Crystal.",
    Fear: "Your Opponent can't deploy Units adjacently, if possible. Start of your Turn: Remove a Fear Token.",
    Glimpse: "Look at the top Card of your Deck. You may put it to the bottom.",
    Obscure: "Look at the top Card of your Opponent's Deck. You may put it on the bottom.",
    Taunt: "Your Opponent has to deploy Units adjacently, if possible. Start of your Turn: Remove this Token.",
    Unearth: null,
    Unleash: "If you meet these Crystals Requirements, do something.",
    Ward: "If a Unit with Ward would be buried, moved, or leave the current Zone because of an Opponent's Effect, instead remove a Ward Token from it.",
    Deploy: null,
    Start_of_your_Turn: null,
    Crystalborn: "When you crystallize this, put a Crystalborn Token on it.",
    Conquer: "If you win a Lane, if this Unit is inside it, do something.",
    Ascend: (type) => `You may deploy a${type !== null && (type.toString().startsWith('a') || type.toString().startsWith('e') || type.toString().startsWith('i') || type.toString().startsWith('o') || type.toString().startsWith('u')) ? 'n' : ''} ${type !== null ? type.toString() : 'Unit'} on top of this. It retains all Buffs.`
};

// Load all .csvs
const allCsvFiles = await loadCSVData(cardFilePath);

// Load cards.
let cards = allCsvFiles
    .filter((card) => card.Name.trim().length > 0);

console.log(`Loaded a total of ${cards.length} cards!`);
// Filter out not-interesting cards.

// Load a potential artwork for each card.
// With lowest priority, the norrmal named artworks are taken.
const artworks = new Map();
const noArtworkString = 'data:image/png;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
fs.readdirSync(artworkFolder, {withFileTypes: true})
    .filter((found) => found.isFile())
    .forEach((found) => artworks.set(found.name.replace(/\.png/i, '').toLowerCase(), found.path + '/' + found.name));

// Next, possible Artworks that were voted for.
Object.entries(JSON.parse(fs.readFileSync(votedArtworkFile).toString()))
    .forEach(([key, value]) => {
        const filePath = `${artworkFolder}/all/${value}`;

        if(!fs.existsSync(filePath)) {
            console.warn(filePath, "does not exist!");
            return;
        }

        artworks.set(key.replaceAll(/[^A-Za-z]/gi, '').toLowerCase(), filePath);
    });

// Load all templates into a Map.
const templates = new Map();
fs.readdirSync(templateFolder, {withFileTypes: true})
    .filter((found) => found.isFile() && found.name.toLowerCase().endsWith('.png'))
    .forEach((found) => {
        const filePath = `${found.path}/${found.name}`;

        templates.set(found.name, filePath);
    });

const svgjsFile = fs.readFileSync(cardLayout).toString();
cards = cards.map((card) => {return {
    ...card,
    Artwork: artworks.get(card.Name.replaceAll(/[^A-Za-z]/g, '').toLowerCase()) ?? noArtworkString}})


const converter = createConverter();

for(let card of cards) {
    console.log(`Creating ${card.Name}...`);
    const template = generateSVGTemplate(card, svgjsFile, templates);
    const baseUrl = `file:///${path.resolve('./')}/`;

    const image = await converter.convert(template, {
        allowDeprecatedAttributes: true,
        baseUrl: baseUrl
    });

    cards[card].Artwork = image;

    createFolderIfNotExists(process.env.EXPORT_IMAGE_FOLDER);
    fs.writeFileSync(`${process.env.EXPORT_IMAGE_FOLDER}/${card.Name}.png`, image);
}
await converter.destroy();

// Create Tabletop Sheets (sorted by rarity);