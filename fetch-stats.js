const axios = require('axios');

// MLB Stats API base URL
const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';

// Team IDs
const TEAM_IDS = {
    ATL: 144,  // Atlanta Braves
    PHI: 143,  // Philadelphia Phillies
    NYM: 121,  // New York Mets
    MIA: 146,  // Miami Marlins
    WSH: 120   // Washington Nationals
};

// League IDs
const LEAGUE_IDS = {
    NL: 104,   // National League
    AL: 103    // American League
};

// Division IDs
const DIVISION_IDS = {
    NL_EAST: 204,  // NL East
    NL_CENTRAL: 205, // NL Central
    NL_WEST: 203,   // NL West
    AL_EAST: 201,   // AL East
    AL_CENTRAL: 202, // AL Central
    AL_WEST: 200    // AL West
};

async function fetchTeamStats(teamId) {
    try {
        const response = await axios.get(`${MLB_API_BASE}/teams/${teamId}/stats`, {
            params: {
                season: new Date().getFullYear(),
                stats: 'season',
                group: 'hitting'
            }
        });
        return response.data.stats[0].splits[0].stat;
    } catch (error) {
        console.error(`Error fetching stats for team ${teamId}:`, error.message);
        return null;
    }
}

async function fetchStandings() {
    try {
        const response = await axios.get(`${MLB_API_BASE}/standings`, {
            params: {
                leagueId: LEAGUE_IDS.NL,
                season: new Date().getFullYear(),
                standingsTypes: 'regularSeason'
            }
        });
        return response.data.records;
    } catch (error) {
        console.error('Error fetching standings:', error.message);
        return null;
    }
}

async function fetchTeamInfo(teamId) {
    try {
        const response = await axios.get(`${MLB_API_BASE}/teams/${teamId}`);
        return response.data.teams[0];
    } catch (error) {
        console.error(`Error fetching team info for ${teamId}:`, error.message);
        return null;
    }
}

async function getNLEastData() {
    const nlEastData = {
        teams: [],
        standings: null,
        stats: {}
    };

    // Fetch standings
    const standings = await fetchStandings();
    if (standings) {
        const nlEastStandings = standings.find(division => division.division.id === DIVISION_IDS.NL_EAST);
        if (nlEastStandings) {
            nlEastData.standings = nlEastStandings.teamRecords.map(team => ({
                teamId: team.team.id,
                name: team.team.name,
                wins: team.wins,
                losses: team.losses,
                winPercentage: team.winningPercentage,
                gamesBack: team.gamesBack,
                streak: team.streak.streakCode
            }));
        }
    }

    // Fetch team info and stats for each NL East team
    for (const teamId of Object.values(TEAM_IDS)) {
        const teamInfo = await fetchTeamInfo(teamId);
        const teamStats = await fetchTeamStats(teamId);

        if (teamInfo) {
            nlEastData.teams.push({
                id: teamInfo.id,
                name: teamInfo.name,
                abbreviation: teamInfo.abbreviation,
                division: teamInfo.division.name,
                league: teamInfo.league.name
            });
        }

        if (teamStats) {
            nlEastData.stats[teamId] = {
                battingAvg: teamStats.avg,
                homeRuns: teamStats.homeRuns,
                rbi: teamStats.rbi,
                ops: teamStats.ops,
                runs: teamStats.runs,
                hits: teamStats.hits,
                slugging: teamStats.slg,
                onBase: teamStats.obp
            };
        }
    }

    return nlEastData;
}

// Main function to run the script
async function main() {
    try {
        const nlEastData = await getNLEastData();
        console.log('NL East Data:', JSON.stringify(nlEastData, null, 2));
    } catch (error) {
        console.error('Error in main function:', error);
    }
}

// Run the script
main(); 