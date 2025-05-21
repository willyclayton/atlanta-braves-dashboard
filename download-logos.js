const https = require('https');
const fs = require('fs');
const path = require('path');

// Change the logos directory to be directly in the root
const LOGOS_DIR = path.join(__dirname, 'logos');

// Ensure logos directory exists
if (!fs.existsSync(LOGOS_DIR)) {
    fs.mkdirSync(LOGOS_DIR, { recursive: true });
}

const teams = {
    'ATL': 144,  // Braves
    'NYM': 121,  // Mets
    'PHI': 143,  // Phillies
    'WSH': 120,  // Nationals
    'MIA': 146,  // Marlins
    'STL': 138,  // Cardinals
    'CHC': 112,  // Cubs
    'MIL': 158,  // Brewers
    'PIT': 134,  // Pirates
    'CIN': 113,  // Reds
    'LAD': 119,  // Dodgers
    'SF': 137,   // Giants
    'SD': 135,   // Padres
    'COL': 115,  // Rockies
    'ARI': 109,  // Diamondbacks
    'NYY': 147,  // Yankees
    'BOS': 111,  // Red Sox
    'TB': 139,   // Rays
    'TOR': 141,  // Blue Jays
    'BAL': 110,  // Orioles
    'CWS': 145,  // White Sox
    'CLE': 114,  // Guardians
    'DET': 116,  // Tigers
    'KC': 118,   // Royals
    'MIN': 142,  // Twins
    'HOU': 117,  // Astros
    'LAA': 108,  // Angels
    'OAK': 133,  // Athletics
    'SEA': 136,  // Mariners
    'TEX': 140   // Rangers
};

function downloadLogo(teamAbbr, teamId) {
    const url = `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
    const filePath = path.join(LOGOS_DIR, `${teamAbbr}.svg`);

    https.get(url, (response) => {
        if (response.statusCode === 200) {
            const file = fs.createWriteStream(filePath);
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Downloaded ${teamAbbr} logo`);
            });
        } else {
            console.error(`Failed to download ${teamAbbr} logo: ${response.statusCode}`);
        }
    }).on('error', (err) => {
        console.error(`Error downloading ${teamAbbr} logo:`, err.message);
    });
}

// Download all logos
Object.entries(teams).forEach(([abbr, id]) => {
    downloadLogo(abbr, id);
}); 