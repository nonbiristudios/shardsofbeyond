"use strict";

import {AssertNode} from 'cardcreator-workflow/dist/main/types/AssertNode.js';
import {CustomNode} from 'cardcreator-workflow/dist/main/types/CustomNode.js';
import {FileLoaderNode} from 'cardcreator-workflow/dist/main/types/FileLoaderNode.js';
import {IteratorNode} from 'cardcreator-workflow/dist/main/types/IteratorNode.js';
import {OneTimeNode} from 'cardcreator-workflow/dist/main/types/OneTimeNode.js';
import {TableNode} from 'cardcreator-workflow/dist/main/types/TableNode.js';

import fs from 'fs';

const dataFolder = './card-data'
const artworkFolder = './artworks';

const realms = new Set(['Divine', 'Elemental', 'Mortal', 'Nature', 'Void']);
const types = new Set(['Human', 'Wizard', 'Angel', 'Insect', 'Spirit', 'Demon', 'Dinosaur', 'Warrior', 'Wizard', 'Construct', 'Plant', 'Dragon', 'Animal', 'Undead', 'Hunter']);
const keywords = new Set(['Ward', 'Fear', 'Taunt', 'Crystalborn']);
const rarities = new Set(['Common', 'Uncommon', 'Rare']);

let dataPath = new OneTimeNode(dataFolder);

let csvPaths = new CustomNode((path) => fs.readdirSync(path, {withFileTypes: true})
    .map((dirent) => `${dirent.path}/${dirent.name}`)
    .filter((path) => path.endsWith('.csv')), dataPath); //read all .csv files in the folder

csvPaths = new IteratorNode(csvPaths);

let setName = new CustomNode((path) => new RegExp('(?<=\\/)[^\\/]*(?=\\.[a-z]{1,5})').exec(path)[0], csvPaths);

let csv = new FileLoaderNode(csvPaths);
csv = new TableNode(csv, { columns: true, cast: true });
csv = new CustomNode((cards, setName) => cards.filter(card => card.Name !== undefined).map((card) => {return {...card, Set: setName}}), csv, setName);

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
    card.Realms = card.Realms.trim().replaceAll('Realm_', '').split(' ').filter((realm) => realm != '');
    card.Types = card.Types.trim().replaceAll(',', '').split(' ').filter((type) => type != '');
    card.Keyword = card.Keyword.trim().replaceAll('\.', '').split(' ').filter((keyword) => keyword != '');
    card.Costs = card.Costs.trim().replaceAll(' ', '').split(',').filter((cost) => cost != '');
    return card;
}, cards);

let checkNominalValues = new AssertNode((card) => {
    return card.Realms.find(realm => !realms.has(realm)) == undefined;
}, (card) => `The card "${card.Name}" has an invalid Realm: ${card.Realms}`, cards);
checkNominalValues = new AssertNode((card) => {
    return card.Types.find(type => !types.has(type)) == undefined;
}, (card) => `The card "${card.Name}" has an invalid Type: ${card.Types}`, checkNominalValues);
checkNominalValues = new AssertNode((card) => {
    return card.Keyword.find(keyword => !keywords.has(keyword)) == undefined;
}, (card) => `The card "${card.Name}" has an invalid Keyword: ${card.Keyword}`, checkNominalValues);
checkNominalValues = new AssertNode((card) => {
    return !rarities.has(card.Rarity) !== undefined;
}, (card) => `The card "${card.Name}" has an invalid Rarity: ${card.Realms}`, checkNominalValues);
checkNominalValues = new AssertNode((card) => {
    return (card.Costs.length == 0) || card.Costs.find(cost => !(cost in [...realms].map(realm => realm[0])) || cost == '?') !== undefined;
}, (card) => `The card "${card.Name}" has an invalid Cost: ${card.Costs}`, checkNominalValues);

let checkRangeValues = new AssertNode((card) => card.Power >= 0 && card.Power <= 10, (card) => `The card "${card.Name}" has an invalid Power: ${card.Power}`, checkNominalValues);
checkRangeValues = new AssertNode((card) => card.Realms.length <= 2, (card) => `The card "${card.Name}" has too many Realms: ${card.Realms}`, checkRangeValues);
checkRangeValues = new AssertNode((card) => card.Types.length <= 2, (card) => `The card "${card.Name}" has too many Types: ${card.Types}`, checkRangeValues);
checkRangeValues = new AssertNode((card) => card.Costs.length <= 6, (card) => `The card "${card.Name}" has too many Costs: ${card.Costs}`, checkRangeValues);

let checkDuplicateValues = new AssertNode((card) => card.Realms.length == new Set(card.Realms).size, (card) => `The card "${card.Name}" has duplicate Realms: ${card.Realms}`, checkRangeValues);
checkDuplicateValues = new AssertNode((card) => card.Types.length == new Set(card.Types).size, (card) => `The card "${card.Name}" has duplicate Types: ${card.Types}`, checkDuplicateValues);

let checkMatchingCostsAndRealms = new AssertNode((card) => card.Costs
    .filter(cost => cost != '?')
    .every(cost => card.Realms.map(realm => realm[0]).includes(cost))
    &&
    card.Realms
    .map(realm => realm[0])
    .every(realm => card.Costs.includes(realm) || card.Costs.filter((cost) => cost != '?').length == 0)
    , (card) => `The card "${card.Name}" has non-matching Costs and Realms: ${card.Costs} ; ${card.Realms}`, checkDuplicateValues);

let checkTitleRegex = new AssertNode((card) => new RegExp('^[A-Z](?:[a-zA-Z][a-z\']*[\\s\\-]?)+[a-zA-Z]$').test(card.Name), 
    (card) => `The card ${card.Name} has a weird name which doesn't follow normal typing rules: ${card.Name}`, 
    checkMatchingCostsAndRealms);
let checkImageExists = new AssertNode((card) => fs.existsSync(`${artworkFolder}/${card.Set}/${card.Name.replaceAll(new RegExp('[\\s\\-\']', 'gm'), '')}.png`), 
    (card) => `The card ${card.Name} has a missing artwork! Expected an artwork to be located here: ${artworkFolder}/${card.Set}/${card.Name.replaceAll(new RegExp('[\\s\\-\']', 'gm'), '')}.png`,
    checkTitleRegex);


//All data is okay at this point
//TODO: grammar parsing for the cards

checkImageExists.run((card) => console.log(`${card.Name} is valid!`), 
    (error) => {
        throw new Error(error);
    });
