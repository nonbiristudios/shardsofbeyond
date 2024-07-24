"use strict";

import { createCanvas, loadImage } from 'canvas';

import {ArrayzerNode} from 'cardcreator-workflow/dist/main/types/ArrayzerNode.js';
import {CustomNode} from 'cardcreator-workflow/dist/main/types/CustomNode.js';
import {FileLoaderNode} from 'cardcreator-workflow/dist/main/types/FileLoaderNode.js';
import {FreezeNode} from 'cardcreator-workflow/dist/main/types/FreezeNode.js';
import {IteratorNode} from 'cardcreator-workflow/dist/main/types/IteratorNode.js';
import {OneTimeNode} from 'cardcreator-workflow/dist/main/types/OneTimeNode.js';
import {TableNode} from 'cardcreator-workflow/dist/main/types/TableNode.js';

import fs from 'fs';
import svgConvert from 'convert-svg-to-png';

const { convert } = svgConvert;

// Folder definitions.
const dataFolder = './card-data'
const artworkFolder = './artworks';
const templateFolder = './templates';
const exportFolder = './export';
const cardLayout = './scripts/template-v3.svgjs';
const tabletopFolder = './tabletop';

const createFolderIfNotExists = (dir) => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
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

// Load all *.csv files from the Data Folder.
let dataPath = new OneTimeNode(dataFolder);
let csvPaths = new CustomNode((path) => fs.readdirSync(path, {withFileTypes: true})
    .map((dirent) => `${dirent.path}/${dirent.name}`)
    .filter((path) => path.endsWith('.csv')), dataPath); //read all .csv files in the folder
csvPaths = new IteratorNode(csvPaths);

let csv = new FileLoaderNode(csvPaths);
csv = new TableNode(csv, { columns: true, cast: true });
csv = new CustomNode((cards) => cards
        .filter(card => card.Name !== undefined)
    , csv);

// Sanitize the Input.
let cards = new IteratorNode(csv);
cards = new CustomNode((card) => {
    if (card.Types == undefined)
        card.Types = '';
    if (card.Realms == undefined)
        card.Realms = '';
    if (card.Keyword == undefined)
        card.Keyword = '';
    if (card.Text == undefined)
        card.Text = '';
    if (card.Flavortext == undefined)
        card.Flavortext = '';
    if (card.Power == undefined)
        card.Power = 0;
    if (card.Costs == undefined)
        card.Costs = '';
    if (card.Rarity == undefined)
        card.Rarity = '';
    if (card.CardID == undefined)
        card.CardID = 0;
    return card;
}, cards);

cards = new CustomNode((card) => {
    card.Realms = card.Realms
        .trim()
        .replaceAll('Realm_', '')
        .split(' ')
        .filter((realm) => realm != '');
    card.Types = card.Types
        .trim()
        .replaceAll(',', '')
        .replaceAll('?', '')
        .split(' ')
        .filter((type) => type != '');
    card.Keyword = card.Keyword
        .trim()
        .replaceAll('\.', '')
        .split(' ')
        .filter((keyword) => keyword != '');
    card.Costs = card.Costs
        .trim()
        .replaceAll(' ', '')
        .split(',')
        .filter((cost) => cost != '');
    card.RandomValue = Math.floor(Math.random() * 100000);
    
    return card;
}, cards);

let collector = new ArrayzerNode(cards);
let iterator = new IteratorNode(collector);

// Load the Image File for each given Card.
let cardImage = new CustomNode((card) => {
    const cardartFileName = card.Name.replaceAll(/[\s\-\']/gm, '');
    const artworks = fs.readdirSync(artworkFolder, {withFileTypes: true})
        .map((path) => path.name)
        .filter((path) => {
            const regex = new RegExp(`${cardartFileName}(?:\\-\\w+)?\\.`);
            return regex.test(path);
        })
        .map((path) => {
            return {
                name: (/(?<=-)[^.]+/g.exec(path) ?? ['default'])[0],
                path: path
            };
        });

    return { ...card, Artwork: artworks};
}, iterator);
cardImage = new FreezeNode(cardImage);

// We don't have all artfiles for prototypes necessarily...
let imageInfo = new CustomNode((card) => card.Artwork, cardImage);
imageInfo = new IteratorNode(imageInfo);

let imagePath = new CustomNode((info) => `${artworkFolder}\\${info.path}`, imageInfo);
// A black image is the default case in that scenario.
let base64image = new FileLoaderNode(imagePath, 'base64', 'R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=');
cardImage = new CustomNode((card, base64image, image) => {
    return {
        ...card,
        Artwork: [`data:image/png;base64,${base64image}`],
        Version: image.name
    };
}, cardImage, base64image, imageInfo);

let svgjs = new OneTimeNode(cardLayout);
svgjs = new FileLoaderNode(svgjs);
svgjs = new FreezeNode(svgjs); // We use the same Template for all iterations.

// Load all Template files from the Template Folder.
let templateFiles = new OneTimeNode(templateFolder);
templateFiles = new CustomNode((folderPath) => fs.readdirSync(folderPath).map((file) => `${folderPath}/${file}`), templateFiles);
let singleTemplateFile = new IteratorNode(templateFiles);
let singleTemplateImage = new FileLoaderNode(singleTemplateFile, 'base64');
templateFiles = new CustomNode((file, content) => {
    return {
        name: file
            .split('\\')
            .pop()
            .split('/')
            .pop(),
        content: `data:image/png;base64,${content}`
    };
}, singleTemplateFile, singleTemplateImage);
templateFiles = new ArrayzerNode(templateFiles);
templateFiles = new CustomNode((templates) => {
    let map = new Map();
    templates.forEach((template) => map.set(template.name, template.content));
    return map;
}, templateFiles);
templateFiles = new FreezeNode(templateFiles); //Keep an Array of all Template files around for the rest of the process.

// Execute all svgjs-Codes in the file.
cardImage = new CustomNode((card, svgCode, templates) => {
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
    const rendered = evaluateFunctions(svgCode, { card: card, explanations: explanations, templates: templates});
    return { ...card, Svg: rendered };
}, cardImage, svgjs, templateFiles);

let svgBuffer = new CustomNode(async (card) => {
    console.log(`Rendering ${card.Name}...`);

    const image = await convert(card.Svg, { allowDeprecatedAttributes: true });
    delete card.Svg; // Free some memory space by deleting the SVG.

    return {
        ...card,
        image: image
    };
}, cardImage);

let exportSingleCard = new CustomNode((card) => {
    //create folder if necessary
    const imageDir = `${exportFolder}/images/`;

    createFolderIfNotExists(exportFolder);
    createFolderIfNotExists(imageDir);
    createFolderIfNotExists(`${imageDir}${card.Version}`);

    fs.writeFileSync(`${imageDir}${card.Version}/${card.Name}.png`, card.image);

    return card;
}, svgBuffer);

// Group cards.
let groupedCards = new ArrayzerNode(exportSingleCard);

groupedCards = new CustomNode((cards) => cards.reduce((prev, curr) => {
    if(prev[curr.Version] === undefined) prev[curr.Version] = [];
    prev[curr.Version].push(curr);

    return prev;
}, {}), groupedCards);

// Make each variation an array.
groupedCards = new CustomNode((cards) => Object.values(cards), groupedCards);

groupedCards = new IteratorNode(groupedCards);

let commonCards = new CustomNode((cards) => cards.filter((card) => card.Rarity === 'Common'), groupedCards);
let uncommonCards = new CustomNode((cards) => cards.filter((card) => card.Rarity === 'Uncommon'), groupedCards);
let rareCards = new CustomNode((cards) => cards.filter((card) => card.Rarity === 'Rare'), groupedCards);

// Render "Deck sheets" for Tabletop Simulator.
let svgMassRenderFunction = async (cards, imageWidth = 750, imageHeight = 1050, numberRows = 7, numberColumns = 10, backgroundFill = 'black') => {
    const canvasWidth = imageWidth * numberColumns;
    const canvasHeight = imageHeight * numberRows;
    const entries = numberRows * numberColumns - 1; //the last entry of the sheet must be black (no card)

    const buffers = [];
    const canvases = [];

    for(let i = 0; i < Math.floor(cards.length / entries) + 1; i++) {
        let canvas = createCanvas(canvasWidth, canvasHeight);
        let ctx = canvas.getContext('2d');
        ctx.fillStyle = backgroundFill;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        canvases.push(canvas);
    }
    
    const imageLoadingPromises = cards.map(async (card, i) => {
        //figure out into which buffer to write
        const targetContext = Math.floor(i / entries);

        i = i % entries;

        const img = await loadImage(card.image);

        const row = Math.floor(i / numberColumns);
        const col = i % numberColumns;
        const x = col * imageWidth;
        const y = row * imageHeight;

        canvases[targetContext].getContext('2d').drawImage(img, x, y, imageWidth, imageHeight);
    });

    (await Promise.all(imageLoadingPromises));
    
    return canvases.map(canvas => canvas.toBuffer());
};

let renderedCommons = new CustomNode(async (cards) => await svgMassRenderFunction(cards), commonCards);
let renderedUncommons = new CustomNode(async (cards) => await svgMassRenderFunction(cards), uncommonCards);
let renderedRares = new CustomNode(async (cards) => await svgMassRenderFunction(cards), rareCards);

// Export all Sheets to its respective files in the Tabletop Folder.
let renderCommons = new CustomNode((buffers, commonCards) => {
    if(commonCards.length == 0) return;
    const setName = commonCards[0].Set;
    const version = commonCards[0].Version;
    
    createFolderIfNotExists(tabletopFolder);
    // TODO: Export set-specific
    const dir = `${tabletopFolder}`;
    createFolderIfNotExists(dir);
    createFolderIfNotExists(`${dir}/${version}`);

    buffers.forEach((buffer, i) => fs.writeFileSync(`${dir}/${version}/commons_${i}.png`, buffer));

    console.log(`Rendered "${version}" Common Cards of Set ${setName}!`);
    return 'done';
}, renderedCommons, commonCards);

let renderUncommons = new CustomNode((buffers, uncommonCards) => {
    if(uncommonCards.length == 0) return;
    const setName = uncommonCards[0].Set;
    const version = uncommonCards[0].Version;

    createFolderIfNotExists(tabletopFolder);
    // TODO: Export set-specific
    const dir = `${tabletopFolder}`;
    createFolderIfNotExists(dir);
    createFolderIfNotExists(`${dir}/${version}`);

    buffers.forEach((buffer, i) => fs.writeFileSync(`${dir}/${version}/uncommons_${i}.png`, buffer));

    console.log(`Rendered "${version}" Uncommon Cards of Set ${setName}!`);
    return 'done';
}, renderedUncommons, uncommonCards);

let renderRares = new CustomNode((buffers, rareCards) => {
    if(rareCards.length == 0) return;
    const setName = rareCards[0].Set;
    const version = rareCards[0].Version;

    createFolderIfNotExists(tabletopFolder);
    // TODO: Export set-specific
    const dir = `${tabletopFolder}`;
    createFolderIfNotExists(dir);
    createFolderIfNotExists(`${dir}/${version}`);

    buffers.forEach((buffer, i) => fs.writeFileSync(`${dir}/${version}/rares_${i}.png`, buffer));

    console.log(`Rendered "${version}" Rare Cards of Set ${setName}!`);
    return 'done';
}, renderedRares, rareCards);

// Wait for all processes to collect.
let renderGroup = new CustomNode((_) => 'done', renderCommons, renderUncommons, renderRares);

renderGroup.run((_) => console.log('Workflow completed successfully!'), (error) => {
    console.log(error);
});
