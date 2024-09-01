"use strict";

import fs from "fs";
import { execSync } from "child_process";
import XLSX from "xlsx";

const requiredParameters = [
  'CARDS_FILE'
];

requiredParameters.forEach((parameter) => {
  if(process.env[parameter] === undefined) {
    throw new Error(`The environment variable "${parameter}" needs to be defined!`);
  }
});

// Read all data (commits and files).

const buffer = execSync(`git log -n 2 --pretty=format:"%H" --follow ${process.env.CARDS_FILE}`).toString();
const [currentCommit, previousCommit] = buffer.split('\n').map((commits) => commits.trim());

console.log(currentCommit);
console.log(previousCommit);

const oldCardFileContent = execSync(`git show ${previousCommit}:${process.env.CARDS_FILE}`);
const newCardFileContent = execSync(`git show ${currentCommit}:${process.env.CARDS_FILE}`);

const oldWorkbook = XLSX.read(oldCardFileContent);
const oldData = XLSX.utils.sheet_to_json(oldWorkbook.Sheets['Sheet1'])
  .reduce((prev, current) => {
    prev[current.Name] = current;
    
    return prev;
  }, {});

const newWorkbook = XLSX.read(newCardFileContent);
const newData = XLSX.utils.sheet_to_json(newWorkbook.Sheets['Sheet1'])
  .reduce((prev, current) => {
    prev[current.Name] = current;
    
    return prev;
  }, {});

const allChanges = {};
// Compare each entry!
Object.values(newData).forEach((line) => {
  const changes = {};
  // Find respective card in old data.
  const oldLine = oldData[line.Name];

  if(oldLine === undefined) {
    console.warn(`${line.Name} is a new card?!`);

    return;
  }

  Object.keys(line).forEach((key) => {
    // Is the attribute different to the old card?
    const oldValue = oldLine[key];
    const newValue = line[key];

    if(oldValue !== newValue) {
      changes[key] = `${oldValue} --> ${newValue}`;
    }
  });

  if(Object.entries(changes).length === 0) return;

  allChanges[line.Name] = changes;
});

console.log(allChanges);