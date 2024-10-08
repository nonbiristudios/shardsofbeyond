import {
  S3Client,
  HeadObjectCommand
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "https";
import fs from "fs";
import { createHash } from "crypto";

const requiredParameters = [
  'TF_VAR_bucket_name',
  'TF_VAR_bucket_region',
  'SPACES_ACCESS_KEY_ID',
  'CARDS_TO_MAKE_PUBLIC_FILE',
  'SPACES_SECRET_ACCESS_KEY',
  'EXPORT_FOLDER',
  'SETS_TO_MAKE_PUBLIC'
];

requiredParameters.forEach((parameter) => {
  if(process.env[parameter] === undefined) {
      throw new Error(`The environment variable "${parameter}" needs to be defined!`);
  }
});

// Defining connection data.
const target = `https://${process.env.TF_VAR_bucket_region}.digitaloceanspaces.com`;
const s3 = new S3Client({
  endpoint: target,
  region: process.env.TF_VAR_bucket_region,
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY_ID,
    secretAccessKey: process.env.SPACES_SECRET_ACCESS_KEY
  },
  requestHandler: new NodeHttpHandler({
    httpsAgent: new https.Agent({
      maxSockets: 25
    })
  })
});

const setsToMakePublic = process.env.SETS_TO_MAKE_PUBLIC.split(',').map((set) => set.trim());
console.log(`Making artifacts of the following set public: ${setsToMakePublic.join(', ')}`);
console.log(`Targeting "${target}..."`);

// Main Uploading Function.
const uploadToS3 = async (folderPath, fileName, key, publicVisible) => {
  // Get local hash.
  const file = fs.readFileSync(`${folderPath}/${fileName}`);
  const hash = createHash('md5').update(file).digest('hex');

  // Fetch remote hash.
  // We catch, in case the object does not yet exist.
  try {
    const remoteHash = (await s3.send(new HeadObjectCommand({
      Bucket: process.env.TF_VAR_bucket_name,
      Key: key
    })))
    .ETag.replaceAll(/\"/g, '');

    if(remoteHash === hash) {
      console.log(`Hash identical for ${fileName}, no update necessary! Skipping...`);
      return;
    }
  } catch(e) {
    console.error(`Could not read head tag for ${fileName}! Reason: ${e}`);
  }

  return new Upload({
    client: s3,
    params: {
      Bucket: process.env.TF_VAR_bucket_name,
      Body: fs.createReadStream(`${folderPath}/${fileName}`),
      Key: key,
      ContentType: 'image/png',
      ACL: publicVisible ? 'public-read' : 'private',
      CacheControl: 'public, max-age=31536000'
    }
  }).done();
};

// Read all exported images so far.
const generatedRenders = fs.readFileSync(process.env.CARDS_TO_MAKE_PUBLIC_FILE, {encoding: "ascii"}).split('\n');
console.log(`Checking: ${generatedRenders.length} cards (Set ${setsToMakePublic.join(', ')}) should be make public.`);

// Read all single image files to be uploaded
const folderPath = `${process.env.EXPORT_FOLDER}/images/`;
const singleImageUploads = fs.readdirSync(folderPath, {withFileTypes: false})
  .map(async (imageFileName, i) => {
    const modifiedName = imageFileName.replace(/\.png$/, '');

    const key = `cards/${modifiedName}.png`;

    // Decide whether we will upload the single card privately or publicly.
    return uploadToS3(folderPath, imageFileName, key, generatedRenders.includes(modifiedName));
  });

await Promise.all(singleImageUploads);
console.log('All single files uploaded!');

// Read all tabletop files to be uploaded
const folderPathTabletop = `${process.env.EXPORT_FOLDER}/tabletop/`;
const tabletopImageUploads = fs.readdirSync(folderPathTabletop, {withFileTypes: false, recursive: true})
  .map((imageFileName, i) => {
    if(!imageFileName.includes('.png')) return;

    const modifiedName = imageFileName.replaceAll(/\.png$/g, '').replaceAll(/\\/g, '/').toLowerCase();
    let set = modifiedName.match(/set-(\d+)/);
    const makePublic = (set === null) ? true : setsToMakePublic.includes(set[1]);

    const key = `tabletop/${modifiedName}.png`;

    // Decide whether we will upload the templates privately or publicly.
    return uploadToS3(folderPathTabletop, imageFileName, key, makePublic);
  });

await Promise.all(tabletopImageUploads);
console.log('All tabletop images uploaded!');