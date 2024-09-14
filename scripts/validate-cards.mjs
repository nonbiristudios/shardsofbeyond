import csv from 'csv-parser';
import fs from 'fs';

const requiredParameters = [
  'CARDS_FILE',
  'SETS_FINALIZED'
];

requiredParameters.forEach((parameter) => {
  if(process.env[parameter] === undefined) {
      throw new Error(`The environment variable "${parameter}" needs to be defined!`);
  }
});

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

const ALLOWED_RARITIES = ['Common', 'Uncommon', 'Rare', 'Terrain'];
const REALMS = ['Divine', 'Mortal', 'Elemental', 'Nature', 'Divine'];
const rules = [
  {text: 'Every card has more than 0 and less than 10 Power', check: (card) => card.Power >= 0 && card.Power < 10},
  {text: 'Every card has more than 0 and not more than 2 Types', check: (card) => {
    const typeCount = card.Types.split(' ').length;
  
    return typeCount > 0 && typeCount <= 2;}
  },
  {text: 'Every Unit has total costs of atleast 1 and not more than 7', check: (card) => {
      if(card.Cardtype === 'Terrain') return true;

      const totalCosts = card.Costs.replaceAll(/[^A-Z?]/g, '').length;

      return totalCosts >= 1 && totalCosts <= 7;
    }
  },
  {text: `Every card has one of the following Rarities: ${ALLOWED_RARITIES.map(r => `"${r}"`).join(', ')}`, check: (card) => {
    const typeCount = ALLOWED_RARITIES.includes(card.Rarity);
  
    return typeCount > 0 && typeCount <= 2;}
  },
  {text: `Every card does not have more than 2 Realms`, check: (card) => card.Realms.split(' ').length <= 2},
  {text: `Every card has no duplicate Realms`, check: (card) => {
      const realms = card.Realms.split(' ');
    
      let fail = false;
      realms.reduce((prev, current) => {
        if(prev.includes(prev)) fail = true;
        prev.push(current);
        
        return prev;
      },[]);

      return !fail;
    }
  },
  {text: `Every card has Realms in alphabetical order`, check: (card) => {
      let correct = true;
      card.Realms.split(' ').reduce((prev, current) => {
        if(prev === undefined) return current;

        if ((+current[0]) < (+prev[0])) correct = false;
        return current;
      }, undefined)
    
      return correct;
    }
  },
  {text: `Every card has Types in alphabetical order`, check: (card) => {
      let correct = true;
      card.Types.split(' ').reduce((prev, current) => {
        if(prev === undefined) return current;

        if ((+current[0]) < (+prev[0])) correct = false;
        return current;
      }, undefined)
    
      return correct;
    }
  },
  {text: `Every card has a sensible flavor text`, check: (card) => card.Flavortext.split(' ').length >= 3},
  {text: `Every card's Realm appears in the costs, too`, check: (card) => {
      if(card.Cardtype === 'Terrain') return true;
      if(card.Realms.trim().length === 0) return true;

      return card.Realms.trim().split(' ').find((realm) => !card.Costs.includes(realm[0])) === undefined;
    }
  },
  {text: `Every card's Cost appears in the Realms, too`, check: (card) => {
      if(card.Cardtype === 'Terrain') return true;

      const costs = card.Costs
        .replaceAll(/[^A-Z]/g, '')
        .trim()
        .split('');

      if(costs.length === 0) return true;

      return costs.filter((realm) => !(new RegExp(`(?:^[${realm}]|\\s[${realm}])`, 'g').test(card.Realms))).length === 0;
    }
  },
  {text: `Every card has atleast 1 Artwork`, check: (card) => {
      const artworkColumns = Object.keys(card).filter((key) => /Artwork.*/.test(key));

      return artworkColumns.filter((column) => (card[column] ?? '').trim().length > 0).length > 0;
    }
  },
  {text: 'Right order of costs', check: (card) => {
      if(card.Cardtype === 'Terrain') return true;
      
      return /^(?:[DEVMN](?:, [DEVMN])*|\?)(?:, \?)*$/.test(card.Costs);
    }
  },
  {text: 'Each Realm has atleast one (mono-color-)card with each possible Power', multiCheck: (cards) => {
    const stats = cards.reduce((prev, current) => {
      if(current.Cardtype === 'Terrain') return prev;

      const realms = current.Realms.split(' ');
      
      // Ignore multi-color cards
      if(realms.length > 1) return prev;
      if(!(current.Realms in prev)) prev[current.Realms] = [];

      if(!(prev[current.Realms].includes(current.Power))) prev[current.Realms].push(current.Power);

      return prev;
    }, {});

    // Powers need to be: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
    console.log(stats);
    return REALMS.filter((realm) => stats[realm].length < 10);
  }},
  {text: 'Each Realm has atleast one (mono-color-)card with each possible total Cost', multiCheck: (cards) => {
    const stats = cards.reduce((prev, current) => {
      const totalCosts = current.Costs.replaceAll(/[^A-Z?]/g, '').length;
      const realms = current.Realms.split(' ');
      
      // Ignore multi-color cards
      if(realms.length > 1) return prev;
      if(!(current.Realms in prev)) prev[current.Realms] = [];

      if(!(prev[current.Realms].includes(current.totalCosts))) prev[current.Realms].push(current.totalCosts);

      return prev;
    }, {});
    
    return REALMS.filter((realm) => stats[realm].length < 7);
  }}
];

const cards = (await loadCSVData(process.env.CARDS_FILE))
  .filter((card) => card.Name.trim().length > 0)
  .filter((card) => process.env.SETS_FINALIZED.split(',').includes(card.Set.trim()));

const failedRules = [];
rules.forEach((rule) => {
  const errors = (rule.check !== undefined) ? cards.filter((card) => !rule.check(card)) : rule.multiCheck(cards);
  const colorize = (errors.length === 0) ? (text) => `\x1b[32m${text}\x1b[0m` : (text) => `\x1b[31m${text}\x1b[0m`;

  console.info(colorize(`${rule.text}.`));
  if(errors.length > 0) {
    errors.forEach((card) => console.error(colorize((rule.check !== undefined) ? `\t--- Card "${card.Name}" violates this rule.` : `\t --- "${card}" violates this rule.`)));
  }
  if(errors.length === 0) return;

  failedRules.push(rule);
});

console.log('\n\n\n');
failedRules.forEach((rule) => console.error(`Rule Violation: "${rule.text}."`));

if(failedRules.length > 0) process.exit(1);