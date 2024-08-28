let artworks;
let reverse_hash_name = {};
const medals = ['🏅','🥈','🥉'];
const medalValues = ['gold', 'silver', 'bronze'];
let table;

const createURL = (id, index) => `https://cdn.midjourney.com/${id}/0_${index}.png`;
async function hash(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return arrayBufferToBase64(new Uint8Array(hash));
}

function arrayBufferToBase64(buffer) {
  // Convert the ArrayBuffer to a Uint8Array
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;

  // Build a binary string from the Uint8Array
  for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
  }

  // Convert the binary string to a Base64 encoded string
  return window.btoa(binary);
}

let votes = {};
let codeField;

document.addEventListener('DOMContentLoaded', async () => {
  data = await fetch('artworks.generated.json');
  artworks = await data.json();
  table = document.getElementById('entries');
  codeField  = document.getElementById('codeInput');

  update();
});

const update = () => {
  // Populate names
  Object.entries(artworks).forEach(async ([name, values]) => {
    // Only show artworks that have atleast one Option!
    if(values.artworks.length <= 1) return;

    votes[values.hashedName] = {};
    reverse_hash_name[values.hashedName] = name;

    images = values.artworks.map((artwork) => 
      `<div class="imageEntry" id="entry-${values.hashedName}-${artwork.hash}">
        <img class="prevent-drag" src=${createURL(artwork.id, artwork.index)}>
        <div class="medal">
          <center>
            <div class="btn-group btn-group-toggle">
              ${medals.map((medal, i) => {
                return `
                  <label class="btn btn-primary">
                    <input 
                      onclick="updateSelection('${values.hashedName}', '${artwork.hash}', ${i}, '${values.checksum}')"
                      type="radio"
                      name="options-${name}-${i}"
                      id="${medalValues[i]}-${values.hashedName}-${artwork.hash}"
                    >
                    ${medal}
                  </label>
                `;
              }).join('\n')}
            </div>
          </center>
        </div>
      </div>
    `);

    table.insertAdjacentHTML('beforeend', 
      `<li class="list-group-item" id="${values.hashedName}">
        <div class="entry wrong" id="entry-${values.hashedName}">
          <div class="name" onclick="toggleImageRow(event)">
            ${name}
          </div>
          <div class="imageRow collapsing">
            <div class="border">
              ${images.join('\n')}
            </div>
          </div>
        </div>
      </li>`);
  });
}

const toggleImageRow = (e) => {
  const imageRow = e.srcElement.parentElement.querySelector(".imageRow");
  const allImageRows = document.querySelectorAll('.imageRow');

  allImageRows.forEach((row) => {
    if(row === allImageRows) return;

    row.classList.add('collapsing');
  });

  if(imageRow.classList.contains('collapsing')) {
    imageRow.classList.remove('collapsing');
  } else {
    imageRow.classList.add('collapsing');
  }
};

const updateSelection = async (cardHash, artworkHash, place, checksum) => {
  // Disable all other selections on that image.
  const otherMedals = [0, 1, 2];

  otherMedals.forEach((medal) => {
    if(otherMedals === place) return;

    const el = document.getElementById(`${medalValues[medal]}-${cardHash}-${artworkHash}`);
    if(el.checked) {
      el.checked = false;
      // Remove from data, too.
      delete votes[cardHash][medal];
    }
  });

  // The artwork might already be voted for with regards to another medal. In that case, reset that rating.
  Object.entries(votes[cardHash])
    .filter(([key, value]) => key !== place && value == artworkHash)
    .forEach(([key, value]) => votes[cardHash][key] = undefined);

  // Save information about selection.
  votes[cardHash] = votes[cardHash] ?? {};
  votes[cardHash][place] = artworkHash;

  votes[cardHash].c = checksum;

  updateCorrectness(cardHash);
};

const updateCode = () => {
  const code = btoa(JSON.stringify(votes));
  codeField.value = code;
};

const codeChanged = () => {
  let json;
  let obj;

  // Try to parse
  try {
    json = atob(codeField.value);
    obj = JSON.parse(json);
  } catch {
    codeField.classList.remove('done');
    codeField.classList.add('wrong');
    return;
  }

  codeField.classList.remove('wrong');

  votes = obj;
  // Populate all fields
  Object.entries(obj).forEach(([name, artworks]) => {
    Object.entries(artworks).forEach(([medal, image]) => {
      if(medal === 'c') return;

      const box = document.getElementById(`${image}_${medal}`);
      if(box === null) return;
      box.checked = true;
    });
    updateCorrectness(name);
  });
}

const updateCorrectness = async (cardHash) => {
  const referencedCard = reverse_hash_name[cardHash];
  // Update marking of title.
  const el = document.getElementById(`entry-${cardHash}`);

  const givenMedals = Object.entries(votes[cardHash] ?? {}).length-1;

  if(votes[cardHash].c !== artworks[referencedCard].checksum) {
    el.classList.remove('done');
    el.classList.add('wrong');
  } else {
    if(givenMedals === 3 || givenMedals === Object.keys(artworks[reverse_hash_name[cardHash]]?.artworks ?? {}).length) {
      el.classList.remove('wrong');
      el.classList.add('done');
      
      updateCode();
      codeField.classList.remove('wrong');
    } else {
      el.classList.remove('done');
      el.classList.add('wrong');
    }
  }

  // Remove colors.
  artworks[reverse_hash_name[cardHash]].artworks.forEach((image) => {
    const entry = document.getElementById(`entry-${cardHash}-${image.hash}`);

    if(!entry) return;

    entry.classList.remove('gold-medal');
    entry.classList.remove('silver-medal');
    entry.classList.remove('bronze-medal');

    // Which medal was given?
    const givenMedal = Object.entries(votes[cardHash])
      .find(([key, value]) => value === image.hash);

    if(givenMedal === undefined) return;

    entry.classList.add(`${medalValues[givenMedal[0]]}-medal`);
  })
};