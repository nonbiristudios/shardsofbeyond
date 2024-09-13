"use strict";

import { execSync } from "child_process";
import XLSX from "xlsx";
import fs from "fs";

const requiredParameters = [
  'CARDS_FILE',
  'CHANGELOG_FILE'
];

const interestingFields = [
  'Power',
  'Rarity',
  'Set',
  'Types',
  'Text',
  'Flavortext',
  'Costs',
  'Rarity'
];

const n = 100;

requiredParameters.forEach((parameter) => {
  if(process.env[parameter] === undefined) {
    throw new Error(`The environment variable "${parameter}" needs to be defined!`);
  }
});

// FUNCTIONS.
const getData = (commit) => {
  const newCardFileContent = execSync(`git show ${commit}:${process.env.CARDS_FILE}`);
  const newWorkbook = XLSX.read(newCardFileContent);
  const newData = XLSX.utils.sheet_to_json(newWorkbook.Sheets['Sheet1'])
    .reduce((prev, current) => {
      prev[current.Name] = current;
      
      return prev;
    }, {});

  return newData;
};

const getChanges = (oldData, newData) => {
  const allChanges = {};
  // Compare each entry!
  Object.values(newData).forEach((line) => {
    const changes = {};
    // Find respective card in old data.
    const oldLine = oldData[line.Name];
  
    if(oldLine === undefined) {
      changes[line.Name] = {};
      changes[line.Name]['new'] = line;
  
      return;
    }
  
    Object.keys(line).forEach((key) => {
      if(!interestingFields.includes(key)) return;
  
      // Is the attribute different to the old card?
      const oldValue = oldLine[key];
      const newValue = line[key];
  
      if(oldValue !== newValue) {
        changes[key] = {};
        changes[key]['old'] = oldValue;
        changes[key]['new'] = newValue;
      }
    });
  
    if(Object.entries(changes).length === 0) return;
  
    allChanges[line.Name] = changes;
  });

  return allChanges;
}

// Read all data (commits and files).

const allChanges = [];
const buffer = execSync(`git log -n ${n} --pretty=format:"%as %H" --follow ${process.env.CARDS_FILE}`).toString();
const commits = buffer
  .split('\n')
  .map((commits) => commits.trim())
  .map((commit) => {
    return {
      hash: commit.split(' ')[1],
      date: commit.split(' ')[0]
    };
  });

for(let i=0;i < (commits.length - 1); i++) {
  try {
    const oldData = getData(commits[i+1].hash);
    const newData = getData(commits[i].hash);

    allChanges.push({date: commits[i].date, changes: getChanges(oldData, newData)});
  } catch(e) {}
};

fs.writeFileSync(process.env.CHANGELOG_FILE, JSON.stringify(allChanges));
console.info(`Wrote changelog file to "${process.env.CHANGELOG_FILE}!`);