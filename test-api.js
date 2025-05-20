// Import fetch for Node.js
import fetch from 'node-fetch';

// MLB Stats API Configuration
const API_BASE = 'https://statsapi.mlb.com/api/v1';
const BRAVES_ID = 144; // MLB Team ID for Atlanta Braves

// Test the MLB API endpoints
async function testMLBAPI() {
    try {
        // First try to get the team roster
        console.log('1. Fetching Braves roster...');
        const rosterUrl = `${API_BASE}/teams/${BRAVES_ID}/roster?rosterType=active`;
        
        const rosterResponse = await fetch(rosterUrl);
        console.log(`Roster API Response status: ${rosterResponse.status}`);
        
        if (!rosterResponse.ok) {
            const text = await rosterResponse.text();
            throw new Error(`Roster API request failed: ${rosterResponse.status} - ${text}`);
        }

        const rosterData = await rosterResponse.json();
        
        // Try to get team statistics
        console.log('\n2. Fetching Braves team info and stats...');
        const teamUrl = `${API_BASE}/teams/${BRAVES_ID}?hydrate=stats(group=[hitting,pitching],type=[yearByYear])`;
        
        const teamResponse = await fetch(teamUrl);
        console.log(`Team API Response status: ${teamResponse.status}`);
        
        if (!teamResponse.ok) {
            const text = await teamResponse.text();
            throw new Error(`Team API request failed: ${teamResponse.status} - ${text}`);
        }

        const teamData = await teamResponse.json();
        
        // Display team information
        if (teamData.teams && teamData.teams[0]) {
            const team = teamData.teams[0];
            console.log('\nTeam Information:');
            console.log('Name:', team.name);
            console.log('Location:', team.locationName);
            console.log('Division:', team.division.name);
            console.log('League:', team.league.name);
            console.log('Spring League:', team.springLeague.name);
            console.log('Venue:', team.venue.name);
            
            if (team.stats) {
                console.log('\nTeam Statistics:');
                team.stats.forEach(statGroup => {
                    console.log(`\n${statGroup.group.displayName}:`);
                    Object.entries(statGroup.splits[0].stat).forEach(([key, value]) => {
                        console.log(`${key}: ${value}`);
                    });
                });
            }
        }

        // Display roster information
        if (rosterData.roster) {
            console.log('\nRoster Information:');
            console.log(`Total players: ${rosterData.roster.length}`);
            
            // Group players by position
            const playersByPosition = {};
            rosterData.roster.forEach(player => {
                const position = player.position.name || 'Unknown';
                if (!playersByPosition[position]) {
                    playersByPosition[position] = [];
                }
                playersByPosition[position].push({
                    name: player.person.fullName,
                    number: player.jerseyNumber,
                    status: player.status?.description
                });
            });

            // Display players by position
            Object.entries(playersByPosition).forEach(([position, players]) => {
                console.log(`\n${position}:`);
                players.sort((a, b) => (parseInt(a.number) || 99) - (parseInt(b.number) || 99))
                      .forEach(player => {
                          const status = player.status ? ` [${player.status}]` : '';
                          console.log(`  - #${player.number || '??'} ${player.name}${status}`);
                      });
            });

            // Get detailed player info for the first few players
            console.log('\n3. Fetching detailed player information for first 3 players...');
            const playerSample = rosterData.roster.slice(0, 3);
            for (const player of playerSample) {
                const playerUrl = `${API_BASE}/people/${player.person.id}?hydrate=stats(group=[hitting,pitching],type=[yearByYear])`;
                const playerResponse = await fetch(playerUrl);
                
                if (playerResponse.ok) {
                    const playerData = await playerResponse.json();
                    if (playerData.people && playerData.people[0]) {
                        const playerInfo = playerData.people[0];
                        console.log(`\nDetailed info for ${playerInfo.fullName}:`);
                        console.log('Position:', playerInfo.primaryPosition.name);
                        console.log('Bats:', playerInfo.batSide.code);
                        console.log('Throws:', playerInfo.pitchHand.code);
                        console.log('Height:', playerInfo.height);
                        console.log('Weight:', playerInfo.weight);
                        console.log('Birth Date:', playerInfo.birthDate);
                        console.log('Birth Place:', `${playerInfo.birthCity}, ${playerInfo.birthCountry}`);
                        
                        if (playerInfo.stats) {
                            console.log('\nCareer Statistics:');
                            playerInfo.stats.forEach(statGroup => {
                                console.log(`\n${statGroup.group.displayName}:`);
                                if (statGroup.splits && statGroup.splits.length > 0) {
                                    const latestStats = statGroup.splits[statGroup.splits.length - 1].stat;
                                    Object.entries(latestStats).forEach(([key, value]) => {
                                        console.log(`${key}: ${value}`);
                                    });
                                }
                            });
                        }
                    }
                }
                // Add a small delay between player requests
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } else {
            console.log('\nNo roster information available in the response');
            console.log('Response structure:', Object.keys(rosterData));
        }
    } catch (error) {
        console.error('\nError testing MLB API:', error.message);
        console.log('\nAPI Documentation: https://statsapi.mlb.com/docs/');
    }
}

// Run the test
console.log('Starting MLB API test...\n');
testMLBAPI(); 