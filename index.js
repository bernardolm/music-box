require("dotenv").config();
const Octokit = require("@octokit/rest");
const fetch = require("node-fetch");
const eaw = require("eastasianwidth");

const {
  GIST_ID: gistId,
  GH_TOKEN: githubToken,
  LASTFM_KEY: lastFmAPIKey,
  LFMUSERNAME: lastFmUser,
  LASTFM_PERIOD: lastFmPeriod,
} = process.env;

const octokit = new Octokit({
  auth: `token ${githubToken}`,
});

const API_BASE =
  "http://ws.audioscrobbler.com/2.0/?method=user.gettopartists&format=json";

async function main() {
  const period = lastFmPeriod ? lastFmPeriod : '7day';

  if (!lastFmAPIKey || !lastFmUser || !gistId || !githubToken)
    throw new Error(
      "Please check your environment variables, as you are missing one."
    );
  const API = `${API_BASE}&period=${period}&user=${lastFmUser}&api_key=${lastFmAPIKey}`;

  console.debug('fething from', API);

  const data = await fetch(API);
  const json = await data.json();

  let gist;
  try {
    gist = await octokit.gists.get({
      gist_id: gistId,
    });
  } catch (error) {
    console.error(`music-box ran into an issue getting your Gist:\n${error}`);
  }

  const numArtitst = Math.min(10, json.topartists.artist.length);
  let playsTotal = 0;
  for (let i = 0; i < numArtitst; i++) {
    playsTotal += parseInt(json.topartists.artist[i].playcount, 10);
  }

  const lines = [];
  for (let i = 0; i < numArtitst; i++) {
    const plays = json.topartists.artist[i].playcount;
    let name = json.topartists.artist[i].name.substring(0, 25);
    // trim off long widechars
    for (let i = 24; i >= 0; i--) {
      if (eaw.length(name) <= 26) break;
      name = name.substring(0, i);
    }
    // pad short strings
    name = name.padEnd(26 + name.length - eaw.length(name));

    lines.push(
      [
        name,
        generateBarChart((plays * 100) / playsTotal, 17),
        `${plays}`.padStart(5),
        "plays",
      ].join(" ")
    );
  }

  try {
    // Get original filename to update that same file
    const filename = Object.keys(gist.data.files)[0];
    await octokit.gists.update({
      gist_id: gistId,
      files: {
        [filename]: {
          filename: `My last.fm in ${period}`,
          content: lines.join("\n"),
        },
      },
    });
  } catch (error) {
    console.error(`Unable to update gist\n${error}`);
  }
}

function generateBarChart(percent, size) {
  const filled = "⣿";
  const empty = "⣀";

  const frac = Math.floor((size * 8 * percent) / 100);
  const barsFull = Math.floor(frac / 8);
  if (barsFull >= size) {
    return filled.repeat(size);
  }

  return filled.repeat(barsFull).padEnd(size, empty);
}

async function updateGist() {
  let gist;
  try {
    gist = await octokit.gists.get({
      gist_id: gistId,
    });
  } catch (error) {
    console.error(`music-box ran into an issue:\n${error}`);
  }
}

(async () => {
  await main();
})();
