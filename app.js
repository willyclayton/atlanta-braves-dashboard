// MLB Stats API Configuration
const MLB_API = 'https://statsapi.mlb.com/api/v1';
const CORS_PROXIES = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url='
];
let currentProxyIndex = 0;

// Function to get API base URL with fallback proxies
function getApiBaseUrl() {
    return `${CORS_PROXIES[currentProxyIndex]}${encodeURIComponent(MLB_API)}`;
}

// Function to switch to next proxy if current one fails
function switchToNextProxy() {
    currentProxyIndex = (currentProxyIndex + 1) % CORS_PROXIES.length;
    return getApiBaseUrl();
}

// Helper function to make API calls with proxy fallback
async function fetchMLBData(endpoint) {
    let attempts = 0;
    const maxAttempts = CORS_PROXIES.length;

    while (attempts < maxAttempts) {
        try {
            const API_BASE = getApiBaseUrl();
            console.log(`Attempting to fetch with proxy ${currentProxyIndex + 1}/${maxAttempts}`);
            
            const response = await fetch(`${API_BASE}/${endpoint}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Origin': window.location.origin
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Proxy ${currentProxyIndex + 1} failed:`, error);
            attempts++;
            
            if (attempts < maxAttempts) {
                console.log('Switching to next proxy...');
                switchToNextProxy();
            } else {
                throw new Error('All proxies failed to fetch data');
            }
        }
    }
}

const BRAVES_ID = 144;
const CURRENT_SEASON = 2025;

// API Endpoints
const ENDPOINTS = {
    teamInfo: `teams/${BRAVES_ID}?hydrate=stats`,
    roster: `teams/${BRAVES_ID}/roster/active?hydrate=person(stats(type=season))`,
    schedule: `schedule/games/?sportId=1&teamId=${BRAVES_ID}&season=${CURRENT_SEASON}&gameType=R`,
    standings: `standings?leagueId=104&season=${CURRENT_SEASON}`,
    playerStats: (playerId) => `people/${playerId}?hydrate=stats(group=[hitting,pitching],type=[season],season=${CURRENT_SEASON})`
};

// Position abbreviation mapping
const POSITION_MAP = {
    'Pitcher': { abbr: 'P', label: 'Pitcher', number: '1' },
    'Catcher': { abbr: 'C', label: 'Catcher', number: '2' },
    'First Base': { abbr: '1B', label: 'First Base', number: '3' },
    'Second Base': { abbr: '2B', label: 'Second Base', number: '4' },
    'Third Base': { abbr: '3B', label: 'Third Base', number: '5' },
    'Shortstop': { abbr: 'SS', label: 'Shortstop', number: '6' },
    'Outfielders': { abbr: 'OF', label: 'Outfielders', number: '7-9' },
    // Keep these for position detection but don't display separately
    'Left Fielder': { abbr: 'LF', label: 'Left Field', number: '7' },
    'Center Fielder': { abbr: 'CF', label: 'Center Field', number: '8' },
    'Right Fielder': { abbr: 'RF', label: 'Right Field', number: '9' },
    'Outfield': { abbr: 'OF', label: 'Outfield', number: '7-9' },
    'Outfielder': { abbr: 'OF', label: 'Outfield', number: '7-9' }
};

// Store roster data globally for position clicks
let currentRosterData = null;
let activePosition = null;
let playerStats = new Map();
let currentRosterView = 'position';

// Helper function to calculate age
function calculateAge(birthDate) {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

// Fetch player statistics
async function fetchPlayerStats(playerId) {
    try {
        console.log(`Fetching stats for player ${playerId}`);
        const response = await fetch(`${getApiBaseUrl()}/${ENDPOINTS.playerStats(playerId)}`);
        if (!response.ok) throw new Error('Failed to fetch player stats');
        
        const data = await response.json();
        console.log('Player data:', data);
        
        const player = data.people[0];
        if (!player) {
            console.log(`No player data found for ID ${playerId}`);
            return null;
        }

        // Find the stats for the current year
        const stats = player.stats || [];
        console.log('Player stats:', stats);
        
        // Look for hitting or pitching stats
        const hittingStats = stats.find(s => s.group === 'hitting')?.splits?.[0]?.stat || {};
        const pitchingStats = stats.find(s => s.group === 'pitching')?.splits?.[0]?.stat || {};
        
        console.log('Hitting stats:', hittingStats);
        console.log('Pitching stats:', pitchingStats);

        return {
            avg: hittingStats.avg?.toFixed(3).replace(/^0/, '') || '.---',
            hits: hittingStats.hits || 0,
            rbi: hittingStats.rbi || 0,
            era: pitchingStats.era?.toFixed(2) || '-.--',
            wins: pitchingStats.wins || 0,
            losses: pitchingStats.losses || 0,
            saves: pitchingStats.saves || 0,
            strikeOuts: pitchingStats.strikeOuts || 0
        };
    } catch (error) {
        console.error(`Error fetching stats for player ${playerId}:`, error);
        return null;
    }
}

// Update team stats based on selected season
async function updateTeamStats(year = CURRENT_SEASON) {
    try {
        document.getElementById('season-record').textContent = 'Loading...';
        
        // Get standings data for record
        const standingsData = await fetchMLBData(`standings?leagueId=104&season=${year}`);
        const bravesRecord = standingsData.records
            .flatMap(r => r.teamRecords)
            .find(t => t.team.id === BRAVES_ID);

        // Get team stats for home runs
        const teamData = await fetchMLBData(`teams/${BRAVES_ID}/stats?stats=season&group=hitting&season=${year}`);
        const teamStats = teamData.stats[0]?.splits[0]?.stat || {};

        // Calculate date range for schedule query
        const today = new Date();
        const startDate = new Date(today);
        startDate.setMonth(startDate.getMonth() - 1); // Look back one month
        
        const formattedStartDate = startDate.toISOString().split('T')[0];
        const formattedEndDate = today.toISOString().split('T')[0];

        // Get schedule data with a simpler query first
        const scheduleData = await fetchMLBData(
            `schedule?teamId=${BRAVES_ID}&startDate=${formattedStartDate}&endDate=${formattedEndDate}&sportId=1`
        );
        
        console.log('Raw schedule data:', scheduleData);
        
        let completedGames = [];
        if (scheduleData.dates && scheduleData.dates.length > 0) {
            // Process all dates
            for (const date of scheduleData.dates) {
                if (date.games) {
                    for (const game of date.games) {
                        // Check if game is completed
                        if (game.status && 
                            (game.status.codedGameState === 'F' || 
                             game.status.codedGameState === 'FT' ||
                             game.status.codedGameState === 'FR' ||
                             game.status.detailedState === 'Final' ||
                             game.status.statusCode === 'F' ||
                             game.status.abstractGameState === 'Final')) {
                            
                            console.log('Found completed game:', {
                                date: date.date,
                                status: game.status,
                                teams: game.teams
                            });
                            
                            completedGames.push(game);
                        }
                    }
                }
            }

            // Sort games by date (most recent first) and take last 5
            completedGames.sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate));
            completedGames = completedGames.slice(0, 5);
            
            console.log('Processed completed games:', completedGames);
        }

        let wins = 0;
        let losses = 0;

        completedGames.forEach(game => {
            // Check both home and away teams
            const braves = game.teams.home.team.id === BRAVES_ID ? game.teams.home : game.teams.away;
            const isWinner = braves.isWinner || (braves.score > (game.teams.home.team.id === BRAVES_ID ? game.teams.away.score : game.teams.home.score));
            
            if (isWinner) {
                wins++;
            } else {
                losses++;
            }
            
            console.log(`Game result: ${isWinner ? 'Win' : 'Loss'}, Score: ${game.teams.home.score}-${game.teams.away.score}`);
        });

        console.log(`Final last 5 record: ${wins}-${losses} (${completedGames.length} games found)`);

        const stats = {
            record: bravesRecord ? `${bravesRecord.wins}-${bravesRecord.losses}` : 'TBD',
            last5: completedGames.length > 0 ? `${wins}-${losses}` : 'Loading...',
            homeRuns: teamStats.homeRuns || 0
        };

        updateStatsDisplay(stats);
    } catch (error) {
        console.error('Error updating team stats:', error);
        console.error('Error details:', error.message);
        updateStatsDisplay({
            record: 'Error',
            last5: 'Error',
            homeRuns: '-'
        });
    }
}

// Helper function to update stats display
function updateStatsDisplay(stats) {
    const statsGrid = document.querySelector('.stats-grid');
    statsGrid.innerHTML = `
        <div class="stat-card">
            <h3>Season Record</h3>
            <p id="season-record">${stats.record}</p>
        </div>
        <div class="stat-card">
            <h3>Last 5 Games</h3>
            <p id="team-last5">${stats.last5}</p>
        </div>
        <div class="stat-card">
            <h3>Team HRs</h3>
            <p id="team-hrs">${stats.homeRuns}</p>
        </div>
    `;
}

// Update roster with player stats
async function updateRoster() {
    try {
        console.log('Fetching roster data...');
        const data = await fetchMLBData(`teams/${BRAVES_ID}/roster/active?hydrate=person(stats(type=season))`);
        console.log('Full roster response:', data);
        
        const rosterContainer = document.getElementById('roster-container');
        
        if (!data.roster || !data.roster.length) {
            rosterContainer.innerHTML = '<p class="error-message">No roster data available</p>';
            return;
        }

        // Store roster data globally and process stats
        currentRosterData = data;
        playerStats.clear();

        // Process stats from hydrated data
        data.roster.forEach(player => {
            console.log(`Processing stats for player:`, player.person);
            const stats = processPlayerStats(player.person);
            console.log(`Processed stats:`, stats);
            if (stats) {
                playerStats.set(player.person.id, stats);
            }
        });

        if (currentRosterView === 'position') {
            updateRosterByPosition(data.roster, rosterContainer);
        } else {
            updateRosterByName(data.roster, rosterContainer);
        }

        // Add click handlers for toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!btn.classList.contains('active')) {
                    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentRosterView = btn.dataset.view;
                    if (currentRosterView === 'position') {
                        updateRosterByPosition(data.roster, rosterContainer);
                    } else {
                        updateRosterByName(data.roster, rosterContainer);
                    }
                }
            });
        });

    } catch (error) {
        console.error('Error updating roster:', error);
        document.getElementById('roster-container').innerHTML = 
            '<p class="error-message">Error loading roster data</p>';
    }
}

function updateRosterByPosition(roster, container) {
    // Group players by position
    const playersByPosition = {};
    roster.forEach(player => {
        let position = player.position.name;
        
        // Group all outfielders together
        if (position === 'Outfield' || position === 'Outfielder' || 
            position === 'Left Fielder' || position === 'Center Fielder' || position === 'Right Fielder') {
            position = 'Outfielders';
        }
        
        if (!playersByPosition[position]) {
            playersByPosition[position] = [];
        }
        playersByPosition[position].push({
            ...player,
            specificPosition: player.position.name // Store original position for display
        });
    });

    // Calculate position stats
    const positionStats = {};
    Object.entries(playersByPosition).forEach(([position, players]) => {
        const stats = players.reduce((acc, player) => {
            const playerStat = playerStats.get(player.person.id) || {};
            if (position === 'Pitcher') {
                const eraValue = parseFloat(playerStat.era);
                if (!isNaN(eraValue)) {
                    acc.era.push(eraValue);
                }
                acc.wins += playerStat.wins || 0;
                acc.strikeOuts += playerStat.strikeOuts || 0;
            } else {
                const avgValue = parseFloat(playerStat.avg);
                if (!isNaN(avgValue)) {
                    acc.avg.push(avgValue);
                }
                acc.hits += parseInt(playerStat.hits) || 0;
                acc.rbi += parseInt(playerStat.rbi) || 0;
            }
            return acc;
        }, { era: [], avg: [], wins: 0, strikeOuts: 0, hits: 0, rbi: 0 });

        if (position === 'Pitcher') {
            const validEraValues = stats.era.filter(era => !isNaN(era));
            const avgEra = validEraValues.length ? 
                (validEraValues.reduce((a, b) => a + b, 0) / validEraValues.length).toFixed(2) : '-.--';
            positionStats[position] = {
                primary: avgEra,
                secondary: stats.wins,
                tertiary: stats.strikeOuts
            };
        } else {
            const validAvgValues = stats.avg.filter(avg => !isNaN(avg));
            const avgBa = validAvgValues.length ? 
                (validAvgValues.reduce((a, b) => a + b, 0) / validAvgValues.length).toFixed(3).replace(/^0/, '') : '.---';
            positionStats[position] = {
                primary: avgBa,
                secondary: stats.hits,
                tertiary: stats.rbi
            };
        }
    });

    // Create position sections
    const positions = [
        'Pitcher', 'Catcher', 'First Base', 'Second Base', 'Third Base', 
        'Shortstop', 'Outfielders'
    ];

    container.innerHTML = positions.map(position => {
        const players = playersByPosition[position] || [];
        const stats = positionStats[position] || {};
        const info = POSITION_MAP[position];
        
        return generatePositionSection(position, players, stats, info);
    }).join('');

    addPositionEventListeners(container);
}

function updateRosterByName(roster, container) {
    const sortedPlayers = [...roster].sort((a, b) => {
        const nameA = a.person.fullName.split(' ').pop();
        const nameB = b.person.fullName.split(' ').pop();
        return nameA.localeCompare(nameB);
    });

    container.innerHTML = `
        <div class="roster-alphabetical">
            ${sortedPlayers.map(player => {
                const stats = playerStats.get(player.person.id) || {};
                const isPitcher = player.position.name === 'Pitcher';
                
                // Simplified mobile view
                const mobileStats = isPitcher ? 
                    `ERA: ${stats.era || '-.--'}` :
                    `AVG: ${stats.avg || '.---'}`;
                
                const fullStats = isPitcher ? `
                    <span class="quick-stat">ERA: ${stats.era || '-.--'}</span>
                    <span class="quick-stat">W-L: ${stats.wins || 0}-${stats.losses || 0}</span>
                ` : `
                    <span class="quick-stat">AVG: ${stats.avg || '.---'}</span>
                    <span class="quick-stat">HR: ${stats.homeRuns || 0}</span>
                `;

                return `
                    <div class="player-card alphabetical" data-player-id="${player.person.id}">
                        <div class="player-card-header">
                            <div class="player-basic-info">
                                <span class="player-number">#${player.jerseyNumber || '??'}</span>
                                <div class="player-name-position">
                                    <span class="player-name">${player.person.fullName}</span>
                                    <span class="specific-position">${player.position.name}</span>
                                </div>
                            </div>
                            <div class="player-quick-stats">
                                ${isMobile ? mobileStats : fullStats}
                            </div>
                        </div>
                        <div class="player-details">
                            ${generatePlayerDetails(player, stats, isPitcher)}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    addPlayerEventListeners(container);
}

function generatePositionSection(position, players, stats, info) {
    return `
        <div class="position-section" data-position="${position}">
            <div class="position-header">
                <div class="position-title">
                    <span class="position-number">${info.number}</span>
                    ${info.label} (${players.length})
                </div>
                <div class="position-aggregate-stats">
                    ${position === 'Pitcher' ? `
                        <span class="aggregate-stat">ERA ${stats.primary}</span>
                        <span class="aggregate-stat">W ${stats.secondary}</span>
                        <span class="aggregate-stat">SO ${stats.tertiary}</span>
                    ` : `
                        <span class="aggregate-stat">AVG ${stats.primary}</span>
                        <span class="aggregate-stat">H ${stats.secondary}</span>
                        <span class="aggregate-stat">RBI ${stats.tertiary}</span>
                    `}
                </div>
                <span class="expand-indicator">▼</span>
            </div>
            <div class="player-list">
                ${players.map(player => generatePlayerCard(player, position)).join('')}
            </div>
        </div>
    `;
}

function generatePlayerCard(player, position) {
    const stats = playerStats.get(player.person.id) || {};
    const isPitcher = position === 'Pitcher';
    const specificPosition = position === 'Outfielders' ? 
        `<span class="specific-position">${player.specificPosition}</span>` : '';
    
    // Simplified stats display for mobile
    const mobileStats = isPitcher ? 
        `ERA: ${stats.era || '-.--'}` :
        `AVG: ${stats.avg || '.---'}`;
    
    const fullStats = isPitcher ? `
        <span class="quick-stat">ERA: ${stats.era || '-.--'}</span>
        <span class="quick-stat">W-L: ${stats.wins || 0}-${stats.losses || 0}</span>
    ` : `
        <span class="quick-stat">AVG: ${stats.avg || '.---'}</span>
        <span class="quick-stat">HR: ${stats.homeRuns || 0}</span>
    `;

    return `
        <div class="player-card" data-player-id="${player.person.id}">
            <div class="player-card-header">
                <div class="player-basic-info">
                    <span class="player-number">#${player.jerseyNumber || '??'}</span>
                    <div class="player-name-position">
                        <span class="player-name">${player.person.fullName}</span>
                        ${specificPosition}
                    </div>
                </div>
                <div class="player-quick-stats">
                    ${isMobile ? mobileStats : fullStats}
                </div>
            </div>
            <div class="player-details">
                ${generatePlayerDetails(player, stats, isPitcher)}
            </div>
        </div>
    `;
}

function generatePlayerDetails(player, stats, isPitcher) {
    return `
        ${player.status?.description ? 
            `<div class="player-status">${player.status.description}</div>` : 
            ''}
        <div class="player-bio">
            <div class="bio-item">
                <span class="bio-label">Born:</span>
                <span class="bio-value">${player.person.birthDate || 'N/A'}${player.person.birthDate ? ` (${calculateAge(player.person.birthDate)})` : ''}</span>
            </div>
            <div class="bio-item">
                <span class="bio-label">From:</span>
                <span class="bio-value">${player.person.birthCity || 'N/A'}, ${player.person.birthStateProvince || ''} ${player.person.birthCountry || ''}</span>
            </div>
            <div class="bio-item">
                <span class="bio-label">Height:</span>
                <span class="bio-value">${player.person.height || 'N/A'}</span>
            </div>
        </div>
        <div class="detailed-stats ${isPitcher ? 'pitching-stats' : 'batting-stats'}">
            ${isPitcher ? generatePitchingStats(stats) : generateBattingStats(stats)}
        </div>
    `;
}

function generatePitchingStats(stats) {
    return `
        <div class="detailed-stat">
            <div class="detailed-stat-label">ERA</div>
            <div class="detailed-stat-value">${stats.era || '-.--'}</div>
        </div>
        <div class="detailed-stat">
            <div class="detailed-stat-label">Wins</div>
            <div class="detailed-stat-value">${stats.wins || 0}</div>
        </div>
        <div class="detailed-stat">
            <div class="detailed-stat-label">Losses</div>
            <div class="detailed-stat-value">${stats.losses || 0}</div>
        </div>
        <div class="detailed-stat">
            <div class="detailed-stat-label">Strikeouts</div>
            <div class="detailed-stat-value">${stats.strikeOuts || 0}</div>
        </div>
        <div class="detailed-stat">
            <div class="detailed-stat-label">Saves</div>
            <div class="detailed-stat-value">${stats.saves || 0}</div>
        </div>
    `;
}

function generateBattingStats(stats) {
    return `
        <div class="detailed-stat">
            <div class="detailed-stat-label">AVG</div>
            <div class="detailed-stat-value">${stats.avg || '.---'}</div>
        </div>
        <div class="detailed-stat">
            <div class="detailed-stat-label">HR</div>
            <div class="detailed-stat-value">${stats.homeRuns || 0}</div>
        </div>
        <div class="detailed-stat">
            <div class="detailed-stat-label">Hits</div>
            <div class="detailed-stat-value">${stats.hits || 0}</div>
        </div>
        <div class="detailed-stat">
            <div class="detailed-stat-label">RBI</div>
            <div class="detailed-stat-value">${stats.rbi || 0}</div>
        </div>
        <div class="detailed-stat">
            <div class="detailed-stat-label">Runs</div>
            <div class="detailed-stat-value">${stats.runs || 0}</div>
        </div>
        <div class="detailed-stat">
            <div class="detailed-stat-label">2B</div>
            <div class="detailed-stat-value">${stats.doubles || 0}</div>
        </div>
    `;
}

function addPositionEventListeners(container) {
    // Add click handlers for position headers
    container.querySelectorAll('.position-header').forEach(header => {
        header.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const section = header.closest('.position-section');
            const wasExpanded = section.classList.contains('expanded');
            
            container.querySelectorAll('.position-section').forEach(s => {
                s.classList.remove('expanded');
            });
            
            if (!wasExpanded) {
                section.classList.add('expanded');
            }
        });

        // Add touch feedback
        header.addEventListener('touchstart', () => {
            header.style.opacity = '0.8';
        }, { passive: true });

        header.addEventListener('touchend', () => {
            header.style.opacity = '1';
        }, { passive: true });
    });

    addPlayerEventListeners(container);
}

function addPlayerEventListeners(container) {
    // Add click handlers for player cards
    container.querySelectorAll('.player-card-header').forEach(header => {
        header.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const card = header.closest('.player-card');
            const wasExpanded = card.classList.contains('expanded');
            
            // In alphabetical view, we can have multiple cards expanded
            if (currentRosterView === 'position') {
                const positionSection = card.closest('.position-section');
                positionSection.querySelectorAll('.player-card').forEach(c => {
                    c.classList.remove('expanded');
                });
            }
            
            if (!wasExpanded) {
                card.classList.add('expanded');
            } else {
                card.classList.remove('expanded');
            }
        });

        // Add touch feedback
        header.addEventListener('touchstart', () => {
            header.style.backgroundColor = 'rgba(19, 39, 79, 0.04)';
        }, { passive: true });

        header.addEventListener('touchend', () => {
            header.style.backgroundColor = '';
        }, { passive: true });
    });
}

// Process player stats from hydrated data
function processPlayerStats(person) {
    console.log('Processing stats for person:', person);
    
    if (!person.stats) {
        console.log('No stats found for person');
        return null;
    }

    // Find the hitting stats for the current season
    const hittingStats = person.stats
        .find(s => s.group.displayName === 'hitting')
        ?.splits?.[0]
        ?.stat || {};

    // Find the pitching stats for the current season
    const pitchingStats = person.stats
        .find(s => s.group.displayName === 'pitching')
        ?.splits?.[0]
        ?.stat || {};

    console.log('Hitting stats found:', hittingStats);
    console.log('Pitching stats found:', pitchingStats);

    // Check if we have any stats at all
    if (Object.keys(hittingStats).length === 0 && Object.keys(pitchingStats).length === 0) {
        console.log('No hitting or pitching stats found');
        return null;
    }

    // Convert string stats to numbers before using toFixed
    const era = typeof pitchingStats.era === 'string' ? parseFloat(pitchingStats.era) : pitchingStats.era;
    const avg = typeof hittingStats.avg === 'string' ? parseFloat(hittingStats.avg) : hittingStats.avg;

    return {
        // Hitting stats
        avg: avg ? avg.toFixed(3).replace(/^0/, '') : '.---',
        hits: hittingStats.hits || 0,
        runs: hittingStats.runs || 0,
        homeRuns: hittingStats.homeRuns || 0,
        stolenBases: hittingStats.stolenBases || 0,
        strikeOuts: hittingStats.strikeOuts || 0,
        doubles: hittingStats.doubles || 0,
        triples: hittingStats.triples || 0,
        rbi: hittingStats.rbi || 0,
        
        // Pitching stats
        era: era ? era.toFixed(2) : '-.--',
        wins: pitchingStats.wins || 0,
        losses: pitchingStats.losses || 0,
        saves: pitchingStats.saves || 0,
        strikeOuts: pitchingStats.strikeOuts || 0
    };
}

// Update field positions
function updateFieldPositions(playersByPosition) {
    const fieldPositions = document.getElementById('field-positions');
    fieldPositions.innerHTML = '';

    Object.entries(POSITION_MAP).forEach(([position, info]) => {
        const marker = document.createElement('div');
        marker.className = `position-marker position-${info.abbr}`;
        marker.textContent = info.number;
        fieldPositions.appendChild(marker);
    });
}

// Update schedule
async function updateSchedule() {
    try {
        const data = await fetchMLBData(ENDPOINTS.schedule);
        const gamesContainer = document.getElementById('upcoming-games');
        
        if (!data.dates || !data.dates.length) {
            gamesContainer.innerHTML = '<p class="error-message">No schedule data available</p>';
            return;
        }

        // Get current date
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // On mobile, only show current week starting from today
        const startDate = new Date(today);
        if (isMobile) {
            // Show next 7 days from today
            const calendarHTML = generateCalendarWeek(data, startDate, today, true);
            gamesContainer.innerHTML = calendarHTML;
        } else {
            // Show two weeks for desktop
            const firstWeekHTML = generateCalendarWeek(data, startDate, today, true);
            const nextWeekStart = new Date(startDate);
            nextWeekStart.setDate(startDate.getDate() + 7);
            const secondWeekHTML = generateCalendarWeek(data, nextWeekStart, today, false);
            
            gamesContainer.innerHTML = firstWeekHTML + secondWeekHTML;
        }
    } catch (error) {
        console.error('Error updating schedule:', error);
        document.getElementById('upcoming-games').innerHTML = 
            '<p class="error-message">Error loading schedule data</p>';
    }
}

// Helper function to generate a week of calendar
function generateCalendarWeek(data, startDate, today, isCurrentWeek) {
    let calendarHTML = '';
    
    // Add week label
    if (!isMobile) {
        calendarHTML += `<div class="week-label">${isCurrentWeek ? 'This Week' : 'Next Week'}</div>`;
    }
    
    // Generate days
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        // Skip past dates on mobile
        if (isMobile && currentDate < today) continue;
        
        const dateStr = currentDate.toDateString();
        const isPastDate = currentDate < today;
        const game = !isPastDate ? findGameForDate(data, dateStr) : null;
        const isToday = currentDate.toDateString() === today.toDateString();
        
        calendarHTML += generateCalendarDay(currentDate, game, isToday, isPastDate);
    }
    
    return calendarHTML;
}

// Helper function to find a game for a specific date
function findGameForDate(data, dateStr) {
    return data.dates
        .flatMap(date => date.games)
        .find(game => new Date(game.gameDate).toDateString() === dateStr);
}

// Helper function to generate a calendar day
function generateCalendarDay(date, game, isToday, isPastDate) {
    const dayClasses = ['calendar-day'];
    if (isToday) dayClasses.push('today');
    if (game) dayClasses.push('has-game');
    if (isPastDate) dayClasses.push('past-date');

    let gameHTML = '';
    if (game && !isPastDate) {
        const gameDate = new Date(game.gameDate);
        const isHome = game.teams.home.team.id === BRAVES_ID;
        const opponent = isHome ? game.teams.away.team : game.teams.home.team;
        
        // Use shorter team names on mobile
        const opponentName = isMobile ? 
            opponent.teamName.replace(/\s/g, '').substring(0, 3).toUpperCase() : 
            opponent.name;
        
        gameHTML = `
            <div class="game-details">
                <div class="game-time">
                    ${gameDate.toLocaleTimeString('en-US', { 
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    })}
                </div>
                <div class="game-indicator ${isHome ? 'home' : 'away'}">
                    ${isHome ? 
                        `<span class="home-indicator"></span>${opponentName}` : 
                        `@${opponentName}`
                    }
                </div>
            </div>
        `;
    }

    return `
        <div class="${dayClasses.join(' ')}">
            <div class="day-header">
                <span class="day-name">${date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span class="day-number">${date.getDate()}</span>
            </div>
            ${gameHTML}
        </div>
    `;
}

// Update the roster view toggle to be more efficient
function updateRosterView() {
    const container = document.getElementById('roster-container');
    const data = currentRosterData;
    
    if (!data || !data.roster || !data.roster.length) {
        container.innerHTML = '<p class="error-message">No roster data available</p>';
        return;
    }

    // Add transition class before changing content
    container.classList.add('view-transition');
    
    // Use requestAnimationFrame to ensure smooth transition
    requestAnimationFrame(() => {
        if (currentRosterView === 'position') {
            updateRosterByPosition(data.roster, container);
        } else {
            updateRosterByName(data.roster, container);
        }
        
        // Remove transition class after content change
        setTimeout(() => {
            container.classList.remove('view-transition');
        }, 300);
    });
}

// Update click handlers for roster view toggle
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!btn.classList.contains('active')) {
                // Update toggle buttons
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update view with transition
                currentRosterView = btn.dataset.view;
                updateRosterView();
            }
        });
    });
});

// Performance optimizations for mobile
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Load initial data
    updateTeamStats(CURRENT_SEASON);
    updateRoster();
    updateSchedule();

    // Refresh data periodically (every 5 minutes)
    // Use longer interval on mobile to save battery
    const refreshInterval = isMobile ? 600000 : 300000;
    setInterval(() => {
        updateTeamStats(CURRENT_SEASON);
        updateRoster();
        updateSchedule();
    }, refreshInterval);

    // Add smooth scrolling for iOS
    if (isMobile) {
        document.querySelectorAll('.player-list, .detailed-stats').forEach(element => {
            element.style.WebkitOverflowScrolling = 'touch';
        });

        // Optimize animations for mobile
        document.documentElement.style.setProperty('--transition-duration', '0.2s');
    }

    // Handle orientation changes
    const handleOrientationChange = debounce(() => {
        // Recalculate layout-dependent values
        document.querySelectorAll('.player-details.expanded').forEach(details => {
            details.style.maxHeight = `${details.scrollHeight}px`;
        });
    }, 250);

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
}); 