"use strict";

import path from 'path';

import fs from 'fs';
import svgConvert from 'convert-svg-to-png';
import csv from 'csv-parser';
import { createCanvas, loadImage } from 'canvas';

const { createConverter } = svgConvert;

const requiredParameters = [
    'CARDS_FILE',
    'ARTWORKS_FOLDER',
    'TEMPLATE_FOLDER',
    'EXPORT_FOLDER',
    'CARD_RENDER_TEMPLATE',
    'DATA_FOLDER',
    'VOTED_ARTWORKS',
    'EXPORT_IMAGE_FOLDER',
    'EXPORT_TABLETOP_FOLDER',
    'SETS_TO_RENDER',
    'SETS_TO_MAKE_PUBLIC',
    'CARDS_TO_MAKE_PUBLIC_FILE',
    'STARTER_DECKS_FILE',
    'EXPORT_TABLETOP_SETS_FOLDER',
    'EXPORT_TABLETOP_STARTERDECKS_FOLDER'
];

requiredParameters.forEach((parameter) => {
    if(process.env[parameter] === undefined) {
        throw new Error(`The environment variable "${parameter}" needs to be defined!`);
    }
});

// VARIABLES.
// Folder definitions.
const votedArtworkFile = process.env.VOTED_ARTWORKS;
const cardFilePath = process.env.CARDS_FILE;
const artworkFolder = process.env.ARTWORKS_FOLDER;
const templateFolder = process.env.TEMPLATE_FOLDER;
const cardLayout = process.env.CARD_RENDER_TEMPLATE;
const setsToRender = process.env.SETS_TO_RENDER.split(',').map((set) => set.trim());
const setsToMakePublic = process.env.SETS_TO_MAKE_PUBLIC.split(',').map((set) => set.trim());

console.log(`Going to Render the following Sets: ${setsToRender}`);

if(!fs.existsSync(process.env.EXPORT_TABLETOP_FOLDER)) {
    fs.mkdirSync(process.env.EXPORT_TABLETOP_FOLDER)
}

// FUNCTIONS.
const processCardName = (name) => name.replaceAll(/[^A-Za-z]/gi, '').toLowerCase();

const createFolderIfNotExists = (dir) => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
};

const renderTabletopSheet = async (name, cards, folder, filename) => {
    const canvases = [spawnCanvas()];
    let targetCanvas = 0;

    console.log(`Starting tabletop render of "${name}": Expecting ${cards.length} cards...`);

    for(let i = 0; i < cards.length; i++) {
        const number = i % entryCount;

        targetCanvas = Math.floor(i / entryCount);
        const targetY = Math.floor(number / numberColumns);
        const targetX = number % numberColumns;

        if(targetCanvas >= canvases.length) {
            canvases.push(spawnCanvas());
        }

        if((cards[i].Artwork ?? '').length === 0) throw new Error(`Artwork for "${cards[i]}" not defined or found!`);

        const image = await loadImage(cards[i].Artwork);
        canvases[targetCanvas].getContext('2d').drawImage(image, targetX * imageWidth, targetY * imageHeight, imageWidth, imageHeight);
    }

    console.log(`"${name}" results in ${canvases.length} buffers.`);
    const buffers = canvases.map((canvas) => canvas.toBuffer());
    
    if(!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
    }

    buffers.forEach((buffer, i) => {
        console.log(`Exporting to ${folder}/${filename}-${i}.png`);
        fs.writeFileSync(`${folder}/${filename}-${i}.png`, buffer);
    });
    
    console.log(`Finished rendering all "${name}" cards!`);
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
    Ally: (type) => `When this is deployed, put an Ally Token on this. Whenever a ${type} is deployed adjacently or this is deployed adjacently to a friendly ${type}, remove this Token to do something.`,
    Ambush: "You may deploy this face-down. At the end of each Turn, if the condition is true and your Crystals meet this Card's Requirements, you may unearth this.",
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
    Ward: "If a Unit with Ward would be buried, moved, or leave the current Zone because of an Opponent's Effect, instead remove this Token from it.",
    Deploy: null,
    Start_of_your_Turn: null,
    Crystalborn: "You may play it from your Crystal Zone and remove this Token.",
    Conquer: "If you win a Lane, if this Unit is inside it, do something.",
    Ascend: (type) => `You may deploy a${type !== null && (type.toString().startsWith('a') || type.toString().startsWith('e') || type.toString().startsWith('i') || type.toString().startsWith('o') || type.toString().startsWith('u')) ? 'n' : ''} ${type !== null ? type.toString() : 'Unit'} on top of this. It retains all Buffs.`
};

// PROCESS.
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
    .forEach((found) => artworks.set(processCardName(found.name), found.path + '/' + found.name));

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
    Artwork: artworks.get(processCardName(card.Name)) ?? noArtworkString}})


const converter = createConverter();

// Create single artworks.
let skippedCards = 0;
let renderedCards = [];
for(let card of cards) {
    if(!setsToRender.includes(card.Set)) {
        skippedCards++;
        continue;
    }

    console.log(`Rendering card #${renderedCards.length}: ${card.Name}...`);

    const template = generateSVGTemplate(card, svgjsFile, templates);
    const baseUrl = `file:///${path.resolve('./')}/`;

    const image = await converter.convert(template, {
        allowDeprecatedAttributes: true,
        baseUrl: baseUrl
    });

    card.Artwork = image;

    createFolderIfNotExists(process.env.EXPORT_IMAGE_FOLDER);
    fs.writeFileSync(`${process.env.EXPORT_IMAGE_FOLDER}/${processCardName(card.Name)}.png`, image);

    // If we want to make the file public
    if(setsToMakePublic.includes(card.Set)) {
        renderedCards.push(processCardName(card.Name));
    }
}

await converter.destroy();

// Export list of all rendered cards.
fs.writeFileSync(process.env.CARDS_TO_MAKE_PUBLIC_FILE, renderedCards.join('\n'));

console.log(`Rendered a total of ${renderedCards.length} cards.`);
console.log(`Skipped ${skippedCards} cards, since their sets were not rendered.`);

// Export Tabletop "Sheets" with all cards, organized by rarity.
const cardsBySet = cards.reduce(
    (prev, current) => {
        if(!setsToRender.includes(current.Set)) return prev;

        if(!(current.Set in prev)) {
            prev[current.Set] = [];
        }

        prev[current.Set].push(current);

        return prev;
    },
    {}
);

// Create canvases of 69 cards each.
const numberColumns = 10;
const numberRows = 7;
const imageWidth = 1500;
const imageHeight = 2100;
const entryCount = (numberRows * numberColumns) - 1;

const canvasWidth = imageWidth * numberColumns;
const canvasHeight = imageHeight * numberRows;

const spawnCanvas = () => {
    let canvas = createCanvas(canvasWidth, canvasHeight);
    let ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    return canvas;
};

const executions = Object.entries(cardsBySet).map(async ([set, cards]) => {
    let executionByRarity = cards
        .reduce(
            (prev, current) => {
                if(!(current.Rarity in prev)) return prev;
                prev[current.Rarity].push(current);
        
                return prev;
            },
            {Common: [], Uncommon: [], Rare: [], Terrain: []}
        );

    console.log(`Starting to render all Set ${set} cards...`);

    executionByRarity = Object.entries(executionByRarity).map(async ([rarity, cards]) => renderTabletopSheet(`Set ${set} ${rarity}`, cards, process.env.EXPORT_TABLETOP_SETS_FOLDER, `set-${set}-${rarity.toLowerCase()}`));
    const results = await Promise.all(executionByRarity);

    console.log(`Finished rendering all ${set} cards!`);
    
    return results;
});

const results = await Promise.all(executions);
console.log('Finished rendering.');

// Render individual Starter Decks.
// Fetch Starter Deck Data.
const starterDecks = (await loadCSVData(process.env.STARTER_DECKS_FILE))
    .filter((entry) => entry['Card List']?.length > 0)
    .reduce((prev, current) => {
        let starterDeck = current['Starter Deck'];
        if(starterDeck?.length === 0) return;

        // Simplify Starter Deck name.
        starterDeck = starterDeck.replaceAll(/[^a-zA-Z]+/g, '_').toLowerCase();

        if(!(starterDeck in prev)) prev[starterDeck] = [];

        // Find Artwork for this card.
        current.Artwork = cards.find((card) => card.Name === current['Card List'])?.Artwork;

        // Duplicate Card according to its Quantity in the Deck.
        for(let i = 0; i < current.Copies; i++) {
            prev[starterDeck].push(current);
        }

        return prev;
    }, {});

const starterDeckRenderExecutions = Object.entries(starterDecks)
    .map(async ([starterDeckName, cards]) => renderTabletopSheet(`Starter Deck (${starterDeckName})`, cards, process.env.EXPORT_TABLETOP_STARTERDECKS_FOLDER, starterDeckName));

await Promise.all(starterDeckRenderExecutions);