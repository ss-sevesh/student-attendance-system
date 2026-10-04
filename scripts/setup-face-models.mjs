import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// face-api.js and its weights are served from this app's origin so the browser
// does not need CDN access. Run this script on a machine with internet access.
const version = '0.22.2';
const scriptSource = `https://cdn.jsdelivr.net/npm/face-api.js@${version}/dist/face-api.min.js`;
const weightsSource = `https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@${version}/weights`;
const destination = join(process.cwd(), 'public', 'face-api');
const weightNames = ['tiny_face_detector_model', 'face_landmark_68_model', 'face_recognition_model'];

async function download(url, target) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  } catch (error) {
    throw new Error(`Could not download ${url}: ${error.message}`);
  }
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`${url} returned an empty file`);
  const temporary = `${target}.download`;
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  console.log(`Saved ${target} (${bytes.length} bytes)`);
}

async function existsNonempty(file) {
  try { return (await stat(file)).size > 0; } catch { return false; }
}

async function main() {
  const weightsDirectory = join(destination, 'weights');
  await mkdir(weightsDirectory, { recursive: true });
  const scriptPath = join(destination, 'face-api.min.js');
  if (!await existsNonempty(scriptPath)) await download(scriptSource, scriptPath);

  for (const name of weightNames) {
    const manifestName = `${name}-weights_manifest.json`;
    const manifestPath = join(weightsDirectory, manifestName);
    if (!await existsNonempty(manifestPath)) await download(`${weightsSource}/${manifestName}`, manifestPath);
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (!Array.isArray(manifest) || !manifest.length) throw new Error(`Invalid ${manifestName}`);
    for (const group of manifest) {
      if (!Array.isArray(group.paths)) throw new Error(`Invalid paths in ${manifestName}`);
      for (const shard of group.paths) {
        if (typeof shard !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(shard)) throw new Error(`Invalid shard name in ${manifestName}`);
        const shardPath = join(weightsDirectory, shard);
        if (!await existsNonempty(shardPath)) await download(`${weightsSource}/${shard}`, shardPath);
      }
    }
  }
  console.log('Face assets are ready under public/face-api. Restart the dev server and retry enrollment.');
}

main().catch((error) => {
  console.error(`Face model setup failed: ${error.message}`);
  console.error('This machine must reach jsDelivr once, or you can copy the listed files into public/face-api from an internet-connected machine.');
  process.exitCode = 1;
});
