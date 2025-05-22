// MLB Stats API Configuration
const MLB_API = 'https://statsapi.mlb.com/api/v1';
const CORS_PROXIES = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url=',
    'https://cors-anywhere.herokuapp.com/'  // Added backup proxy
];
let currentProxyIndex = 0;

// Function to get API base URL with fallback proxies
function getApiBaseUrl() {
    const baseUrl = `${CORS_PROXIES[currentProxyIndex]}${encodeURIComponent(MLB_API)}`;
    console.log('Using API base URL:', baseUrl);
    return baseUrl;
}

// Function to switch to next proxy if current one fails
async function switchToNextProxy() {
    currentProxyIndex = (currentProxyIndex + 1) % CORS_PROXIES.length;
    console.log(`Switching to proxy ${currentProxyIndex + 1}/${CORS_PROXIES.length}`);
    return getApiBaseUrl();
}

// Helper function to make API calls with proxy fallback
async function fetchMLBData(endpoint) {
    let attempts = 0;
    const maxAttempts = CORS_PROXIES.length;
    
    while (attempts < maxAttempts) {
        try {
            const API_BASE = getApiBaseUrl();
            console.log(`Attempting to fetch ${endpoint} with proxy ${currentProxyIndex + 1}/${maxAttempts}`);
            
            const response = await fetch(`${API_BASE}/${endpoint}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Origin': window.location.origin
                },
                mode: 'cors'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Successfully fetched data from ${endpoint}`);
            return data;
        } catch (error) {
            console.error(`Proxy ${currentProxyIndex + 1} failed:`, error);
            attempts++;
            
            if (attempts < maxAttempts) {
                console.log('Switching to next proxy...');
                await switchToNextProxy();
            } else {
                throw new Error(`All proxies failed to fetch data: ${error.message}`);
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

// Team abbreviation mapping (make this global)
const cityTeamMap = {
    'Atlanta Braves': 'ATL',
    'New York Mets': 'NYM',
    'Philadelphia Phillies': 'PHI',
    'Washington Nationals': 'WSH',
    'Miami Marlins': 'MIA',
    'St. Louis Cardinals': 'STL',
    'Chicago Cubs': 'CHC',
    'Milwaukee Brewers': 'MIL',
    'Pittsburgh Pirates': 'PIT',
    'Cincinnati Reds': 'CIN',
    'Los Angeles Dodgers': 'LAD',
    'San Francisco Giants': 'SF',
    'San Diego Padres': 'SD',
    'Colorado Rockies': 'COL',
    'Arizona Diamondbacks': 'ARI',
    'New York Yankees': 'NYY',
    'Boston Red Sox': 'BOS',
    'Tampa Bay Rays': 'TB',
    'Toronto Blue Jays': 'TOR',
    'Baltimore Orioles': 'BAL',
    'Chicago White Sox': 'CWS',
    'Cleveland Guardians': 'CLE',
    'Detroit Tigers': 'DET',
    'Kansas City Royals': 'KC',
    'Minnesota Twins': 'MIN',
    'Houston Astros': 'HOU',
    'Los Angeles Angels': 'LAA',
    'Oakland Athletics': 'OAK',
    'Seattle Mariners': 'SEA',
    'Texas Rangers': 'TEX'
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

// Helper function to calculate winning percentage
function calculateWinningPercentage(wins, losses) {
    if (wins === 0 && losses === 0) return '000';
    const percentage = wins / (wins + losses);
    return percentage.toFixed(3).substring(2); // Remove '0.' from the start
}

// Helper function to get ordinal suffix
function getOrdinalSuffix(number) {
    const j = number % 10;
    const k = number % 100;
    if (j == 1 && k != 11) return number + "st";
    if (j == 2 && k != 12) return number + "nd";
    if (j == 3 && k != 13) return number + "rd";
    return number + "th";
}

// Helper function to get team name without city
function getTeamNameWithoutCity(fullName) {
    return cityTeamMap[fullName] || fullName;
}

// Add new function to fetch season history
async function fetchSeasonHistory(year = CURRENT_SEASON) {
    try {
        const seasonStart = `${year}-03-01`; // Start from March 1st
        const today = new Date().toISOString().split('T')[0];
        
        const scheduleData = await fetchMLBData(
            `schedule?teamId=${BRAVES_ID}&startDate=${seasonStart}&endDate=${today}&sportId=1&gameType=R`
        );
        
        let games = [];
        let currentRecord = { wins: 0, losses: 0 };
        let currentStreak = { type: null, count: 0 };
        let seriesTracker = { opponent: null, wins: 0, gamesInSeries: 0 };
        
        if (scheduleData.dates) {
            // First pass: collect all games to track series
            const allGames = [];
            for (const date of scheduleData.dates) {
                for (const game of date.games) {
                    if (game.gameType === 'R' && 
                        (game.status.codedGameState === 'F' || 
                         game.status.codedGameState === 'FT' ||
                         game.status.codedGameState === 'FR' ||
                         game.status.detailedState === 'Final')) {
                        allGames.push(game);
                    }
                }
            }
            
            // Sort games by date
            allGames.sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
            
            // Process games and detect sweeps
            for (let i = 0; i < allGames.length; i++) {
                const game = allGames[i];
                const bravesTeam = game.teams.home.team.id === BRAVES_ID ? game.teams.home : game.teams.away;
                const opponentTeam = game.teams.home.team.id === BRAVES_ID ? game.teams.away : game.teams.home;
                const isHome = game.teams.home.team.id === BRAVES_ID;
                const isWin = bravesTeam.score > opponentTeam.score;
                
                // Check if this is a new series
                if (opponentTeam.team.id !== seriesTracker.opponent) {
                    seriesTracker = {
                        opponent: opponentTeam.team.id,
                        wins: isWin ? 1 : 0,
                        gamesInSeries: 1
                    };
                } else {
                    seriesTracker.wins += isWin ? 1 : 0;
                    seriesTracker.gamesInSeries++;
                }
                
                // Check if next game is against a different opponent (series end)
                const isSeriesEnd = i === allGames.length - 1 || 
                    (allGames[i + 1].teams.home.team.id === BRAVES_ID ? 
                        allGames[i + 1].teams.away.team.id : 
                        allGames[i + 1].teams.home.team.id) !== seriesTracker.opponent;
                
                const isSweep = isSeriesEnd && 
                    seriesTracker.wins === seriesTracker.gamesInSeries && 
                    seriesTracker.gamesInSeries >= 2;
                
                // Update streak
                if (currentStreak.type === null) {
                    currentStreak.type = isWin ? 'W' : 'L';
                    currentStreak.count = 1;
                } else if (currentStreak.type === (isWin ? 'W' : 'L')) {
                    currentStreak.count++;
                } else {
                    currentStreak.type = isWin ? 'W' : 'L';
                    currentStreak.count = 1;
                }
                
                if (isWin) {
                    currentRecord.wins++;
                } else {
                    currentRecord.losses++;
                }
                
                games.push({
                    date: new Date(game.gameDate),
                    opponent: getTeamNameWithoutCity(opponentTeam.team.name),
                    isHome: isHome,
                    bravesScore: bravesTeam.score,
                    opponentScore: opponentTeam.score,
                    record: `${currentRecord.wins}-${currentRecord.losses}`,
                    streak: `${currentStreak.type}${currentStreak.count}`,
                    isSweep: isSweep
                });
            }
        }
        
        return games.sort((a, b) => b.date - a.date);
    } catch (error) {
        console.error('Error fetching season history:', error);
        return [];
    }
}

// Update the display season history function to include sweep indicator
function displaySeasonHistory(games) {
    const historyContainer = document.getElementById('season-history');
    if (!historyContainer) return;
    
    const gamesList = games.map(game => {
        const dateStr = game.date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric'
        });
        const locationStr = game.isHome ? 'vs.' : '@';
        const result = game.bravesScore > game.opponentScore ? 'W' : 'L';
        const combinedResult = `${result} ${game.bravesScore}-${game.opponentScore}`;
        
        // Add sweep indicator if applicable
        const sweepIndicator = game.isSweep ? 
            '<span class="sweep-indicator" title="Series Sweep">🧹</span>' : '';
        
        return `
            <div class="game-history-item ${result.toLowerCase()}">
                <span class="game-date">${dateStr}</span>
                <span class="game-opponent">${locationStr} ${game.opponent}${sweepIndicator}</span>
                <span class="game-result">${combinedResult}</span>
                <span class="game-record">${game.record}</span>
                <span class="game-streak">${game.streak}</span>
            </div>
        `;
    }).reverse().join('');
    
    historyContainer.innerHTML = `
        <div class="game-history-header">
            <span>Date</span>
            <span>Opponent</span>
            <span>Result</span>
            <span>Record</span>
            <span>Streak</span>
        </div>
        <div class="game-history-list">
            ${gamesList}
        </div>
    `;

    // After rendering, scroll to the bottom
    const gameHistoryList = historyContainer.querySelector('.game-history-list');
    if (gameHistoryList) {
        // Use requestAnimationFrame to ensure the DOM has updated
        requestAnimationFrame(() => {
            gameHistoryList.scrollTop = gameHistoryList.scrollHeight;
        });
    }
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
                    ${isPitcher ? `
                        <span class="quick-stat">ERA: ${stats.era || '-.--'}</span>
                        <span class="quick-stat">W-L: ${stats.wins || 0}-${stats.losses || 0}</span>
                    ` : `
                        <span class="quick-stat">AVG: ${stats.avg || '.---'}</span>
                        <span class="quick-stat">HR: ${stats.homeRuns || 0}</span>
                    `}
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

// Update schedule with better error handling
async function updateSchedule() {
    const gamesContainer = document.getElementById('upcoming-games');
    
    try {
        // Show loading state
        gamesContainer.innerHTML = '<div class="loading">Loading schedule...</div>';
        
        console.log('Fetching schedule data...');
        const data = await fetchMLBData(ENDPOINTS.schedule);
        console.log('Schedule data received:', data);
        
        if (!data || !data.dates) {
            throw new Error('Invalid schedule data format received');
        }
        
        if (!data.dates.length) {
            gamesContainer.innerHTML = '<p class="error-message">No games scheduled at this time</p>';
            return;
        }

        // Get current date and find the start of the current week (Sunday)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        console.log('Current date:', today);

        // Find the previous Sunday
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - today.getDay());
        console.log('Start date (Sunday):', startDate);

        // Generate calendar for two weeks
        const nextWeekStart = new Date(startDate);
        nextWeekStart.setDate(startDate.getDate() + 7);
        
        const calendar = document.createElement('div');
        calendar.className = 'schedule-grid';
        calendar.innerHTML = generateCalendarWeek(data, startDate, today) + 
                           generateCalendarWeek(data, nextWeekStart, today);
        
        // Clear loading state and update container
        gamesContainer.innerHTML = '';
        gamesContainer.appendChild(calendar);
        
        console.log('Schedule update complete');
    } catch (error) {
        console.error('Error updating schedule:', error);
        gamesContainer.innerHTML = `
            <div class="error-message">
                <p>Unable to load schedule data</p>
                <button onclick="updateSchedule()" class="retry-button">Retry</button>
            </div>
        `;
    }
}

// Helper function to find a game for a specific date
function findGameForDate(data, dateStr) {
    try {
        if (!data.dates) {
            console.log('No dates array in data:', data);
            return null;
        }
        
        const game = data.dates
            .flatMap(date => {
                console.log('Processing date:', date.date);
                return date.games || [];
            })
            .find(game => {
                const gameDate = new Date(game.gameDate).toDateString();
                console.log('Comparing dates:', { gameDate, dateStr });
                return gameDate === dateStr;
            });
            
        return game;
    } catch (error) {
        console.error('Error in findGameForDate:', error);
        return null;
    }
}

// Helper function to generate a calendar day
function generateCalendarDay(date, game, isToday) {
    const dayClasses = ['calendar-day'];
    if (isToday) dayClasses.push('today');
    if (!game) dayClasses.push('empty');
    if (game && game.teams.home.team.id === BRAVES_ID) {
        dayClasses.push('has-home-game');
    }

    return `
        <div class="${dayClasses.join(' ')}">
            <div class="day-header">
                <span class="day-name">${date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span class="day-number">${date.getDate()}</span>
            </div>
            ${game ? generateGameDetails(game) : '<div class="no-games"></div>'}
        </div>
    `;
}

// Update the getTeamLogoUrl function to use .svg and cityTeamMap
function getTeamLogoUrl(teamName) {
    const abbreviation = getTeamAbbreviation(teamName);
    if (!abbreviation) return null;
    return `./logos/${abbreviation.toLowerCase()}.svg`;
}

// Helper function to generate game details
function generateGameDetails(game) {
    try {
        if (!game || !game.gameDate) {
            console.error('Invalid game data:', game);
            return '';
        }

        const gameDate = new Date(game.gameDate);
        const isHome = game.teams.home.team.id === BRAVES_ID;
        const opponent = isHome ? game.teams.away.team : game.teams.home.team;
        
        // Format opponent name for mobile - use abbreviation if available
        const opponentName = opponent.teamName || opponent.name || '';
        const logoUrl = getTeamLogoUrl(opponentName);
        
        // Add console.log to debug team name mapping
        console.log('Team name mapping:', {
            originalName: opponentName,
            abbreviation: getTeamAbbreviation(opponentName),
            logoUrl: logoUrl
        });
        
        return `
            <div class="game-time">
                ${gameDate.toLocaleTimeString('en-US', { 
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                })}
            </div>
            <div class="game-indicator ${isHome ? 'home' : ''}">
                ${logoUrl ? `<div class="team-logo"><img src="${logoUrl}" alt="${opponentName} logo" /></div>` : ''}
            </div>
        `;
    } catch (error) {
        console.error('Error in generateGameDetails:', error);
        return '';
    }
}

// Helper function to generate a week of calendar
function generateCalendarWeek(data, startDate, today) {
    try {
        const isCurrentWeek = startDate.getTime() <= today.getTime() && 
            startDate.getTime() + (7 * 24 * 60 * 60 * 1000) > today.getTime();
        
        let weekHTML = `
            <div class="week-section">
                <div class="week-label">${isCurrentWeek ? 'This Week' : 'Next Week'}</div>
                <div class="week-days">
        `;
        
        // Generate all seven days of the week
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            const dateStr = currentDate.toDateString();
            
            const game = findGameForDate(data, dateStr);
            const isToday = currentDate.toDateString() === today.toDateString();
            
            weekHTML += generateCalendarDay(currentDate, game, isToday);
        }
        
        weekHTML += `
                </div>
            </div>
        `;
        
        return weekHTML;
    } catch (error) {
        console.error('Error in generateCalendarWeek:', error);
        throw error;
    }
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

// Add performance optimizations for mobile
const isMobile = window.matchMedia('(max-width: 768px)').matches;
const supportsIntersectionObserver = 'IntersectionObserver' in window;

// Lazy loading for player cards
if (supportsIntersectionObserver) {
    const playerCardObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const playerCard = entry.target;
                if (!playerCard.dataset.loaded) {
                    loadPlayerDetails(playerCard);
                    playerCard.dataset.loaded = 'true';
                }
            }
        });
    }, {
        rootMargin: '50px',
        threshold: 0.1
    });

    document.querySelectorAll('.player-card').forEach(card => {
        playerCardObserver.observe(card);
    });
}

// Debounce function for performance
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

// Throttle function for performance
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Optimize scroll handling
const handleScroll = throttle(() => {
    // Your scroll handling code here
}, 100);

window.addEventListener('scroll', handleScroll, { passive: true });

// Optimize touch interactions
if (isMobile) {
    document.addEventListener('touchstart', () => {}, { passive: true });
    
    // Use pointer events instead of mouse events for better touch performance
    document.querySelectorAll('.player-card-header').forEach(header => {
        header.addEventListener('pointerdown', handlePlayerCardClick, { passive: true });
    });
    
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.addEventListener('pointerdown', handleCalendarDayClick, { passive: true });
    });
}

// Optimize animations
if (isMobile) {
    document.documentElement.style.setProperty('--transition-duration', '0.2s');
}

// Add loading states
function showLoadingState(element) {
    element.classList.add('loading-skeleton');
}

function hideLoadingState(element) {
    element.classList.remove('loading-skeleton');
}

// Optimize data fetching
async function fetchMLBData(endpoint) {
    showLoadingState(document.querySelector('.roster-container'));
    
    try {
        const response = await fetch(`${getApiBaseUrl()}/${endpoint}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Origin': window.location.origin
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        hideLoadingState(document.querySelector('.roster-container'));
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        hideLoadingState(document.querySelector('.roster-container'));
        throw error;
    }
}

// Cache frequently accessed DOM elements
const domCache = {
    rosterContainer: document.querySelector('.roster-container'),
    calendarGrid: document.querySelector('.schedule-grid'),
    playerCards: document.querySelectorAll('.player-card'),
    calendarDays: document.querySelectorAll('.calendar-day')
};

// Use ResizeObserver for responsive updates
if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(debounce((entries) => {
        for (const entry of entries) {
            if (entry.target === domCache.rosterContainer) {
                updateLayoutForScreenSize();
            }
        }
    }, 250));

    resizeObserver.observe(domCache.rosterContainer);
}

// Update layout based on screen size
function updateLayoutForScreenSize() {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const isSmallMobile = window.matchMedia('(max-width: 480px)').matches;
    
    if (isSmallMobile) {
        // Apply small mobile optimizations
        document.documentElement.style.setProperty('--calendar-day-height', '70px');
        document.documentElement.style.setProperty('--player-card-padding', '0.5rem');
    } else if (isMobile) {
        // Apply regular mobile optimizations
        document.documentElement.style.setProperty('--calendar-day-height', '80px');
        document.documentElement.style.setProperty('--player-card-padding', '0.75rem');
    } else {
        // Apply desktop styles
        document.documentElement.style.setProperty('--calendar-day-height', '120px');
        document.documentElement.style.setProperty('--player-card-padding', '1rem');
    }
}

// Initialize performance optimizations
function initializePerformanceOptimizations() {
    updateLayoutForScreenSize();
    window.addEventListener('resize', debounce(updateLayoutForScreenSize, 250));
}

// Call initialization when DOM is ready
document.addEventListener('DOMContentLoaded', initializePerformanceOptimizations);

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Load initial data
    updateTeamStats(CURRENT_SEASON);
    updateRoster();
    updateSchedule();

    // Refresh data periodically (every 5 minutes)
    setInterval(() => {
        updateTeamStats(CURRENT_SEASON);
        updateRoster();
        updateSchedule();
    }, 300000);

    // Add smooth scrolling for touch devices
    if ('ontouchstart' in window) {
        document.querySelectorAll('.player-list, .detailed-stats').forEach(element => {
            element.style.WebkitOverflowScrolling = 'touch';
        });
    }

    // Handle orientation changes
    const handleOrientationChange = debounce(() => {
        document.querySelectorAll('.player-details.expanded').forEach(details => {
            details.style.maxHeight = `${details.scrollHeight}px`;
        });
    }, 250);

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
});

// Update getTeamRankings function to include all teams
async function getTeamRankings() {
    try {
        // Get all MLB standings
        const standingsData = await fetchMLBData('standings?leagueId=103,104&season=' + CURRENT_SEASON);
        console.log('Full standings data:', standingsData);
        
        if (!standingsData || !standingsData.records) {
            throw new Error('Invalid standings data received');
        }
        
        let divisionRank = '';
        let overallRank = 0;
        let divisionStandings = [];
        let allTeams = [];
        
        // Process standings data
        allTeams = standingsData.records.flatMap(record => {
            if (!record || !record.teamRecords) return [];
            
            const division = record.division?.name || 'Unknown Division';
            return record.teamRecords.map(team => ({
                ...team,
                division,
                divisionRank: team.divisionRank || 0,
                winningPct: parseFloat(team.winningPercentage || '0'),
                teamName: team.team?.name || '',
            }));
        });
        
        // Sort all teams by winning percentage for overall MLB rank
        const sortedTeams = [...allTeams].sort((a, b) => b.winningPct - a.winningPct);
        
        // Find NL East division data - try multiple possible division names
        console.log('Division names/IDs in API:', standingsData.records.map(r => ({
            name: r?.division?.name,
            id: r?.division?.id
        })));

        const nlEastDivision = standingsData.records.find(record => {
            if (!record || !record.division || !record.division.name) return false;
            const divName = record.division.name.toLowerCase();
            return divName.includes('national') && divName.includes('east') ||
                   divName === 'nl east' ||
                   record.division.id === 204; // NL East division ID
        });
        if (!nlEastDivision) {
            console.warn('NL East Division not found in API, using manual fallback.');
        }
        
        console.log('NL East Division data:', nlEastDivision);
        
        if (nlEastDivision && nlEastDivision.teamRecords) {
            divisionStandings = nlEastDivision.teamRecords.map(team => ({
                ...team,
                division: nlEastDivision.division.name,
                divisionRank: team.divisionRank || 0,
                winningPct: parseFloat(team.winningPercentage || '0')
            }));
            
            // Sort division standings by division rank
            divisionStandings.sort((a, b) => a.divisionRank - b.divisionRank);
        } else {
            console.log('Falling back to manual NL East team filtering');
            // Fallback: manually filter NL East teams
            const nlEastTeamIds = [144, 121, 146, 120, 143];
            divisionStandings = allTeams
                .filter(team => nlEastTeamIds.includes(team.team.id))
                .sort((a, b) => b.winningPct - a.winningPct)
                .map((team, index) => ({
                    ...team,
                    divisionRank: index + 1,
                    teamName: team.team?.name || '',
                }));
        }
        
        console.log('Division standings:', divisionStandings);
        
        // Find Braves' rankings
        const bravesInfo = divisionStandings.find(team => team.team.id === BRAVES_ID);
        if (bravesInfo) {
            divisionRank = `${getOrdinalSuffix(bravesInfo.divisionRank)} NL East`;
            overallRank = sortedTeams.findIndex(team => team.team.id === BRAVES_ID) + 1;
        }
        
        return {
            divisionRank,
            overallRank: getOrdinalSuffix(overallRank) + ' MLB',
            divisionStandings,
            allTeams: sortedTeams
        };
    } catch (error) {
        console.error('Error getting team rankings:', error);
        return {
            divisionRank: '-',
            overallRank: '-',
            divisionStandings: [],
            allTeams: []
        };
    }
}

// Update the stats display function
function updateStatsDisplay(stats) {
    const container = document.querySelector('.dashboard-section');
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card clickable" id="record-card">
                <h3>Season Record</h3>
                <p id="season-record">${stats.record}</p>
            </div>
            <div class="stat-card clickable" id="league-card">
                <h3>Around the League</h3>
                <p id="team-rankings" class="around-league-multiline">
                    <span>${stats.divisionRank}</span>
                    <span>${stats.overallRank}</span>
                </p>
            </div>
            <div class="stat-card">
                <h3>Team HRs</h3>
                <p id="team-hrs">${stats.homeRuns}</p>
            </div>
        </div>
        <div id="season-history" class="season-history-container"></div>
        <div id="league-overview" class="league-overview-container">
            <div class="division-standings">
                <div class="standings-header">
                    <h3>Standings</h3>
                    <div class="standings-toggle">
                        <button class="toggle-btn active" data-view="division">Division</button>
                        <button class="toggle-btn" data-view="league">League</button>
                        <button class="toggle-btn" data-view="rankings">Rankings</button>
                    </div>
                </div>
                <div class="standings-content"></div>
            </div>
        </div>
    `;
    
    // Add click handlers
    const recordCard = document.getElementById('record-card');
    const leagueCard = document.getElementById('league-card');
    const historyContainer = document.getElementById('season-history');
    const leagueContainer = document.getElementById('league-overview');
    
    recordCard.addEventListener('click', async () => {
        if (historyContainer.classList.contains('expanded')) {
            historyContainer.classList.remove('expanded');
            return;
        }
        
        // Close league overview if open
        leagueContainer.classList.remove('expanded');
        
        historyContainer.innerHTML = '<div class="loading">Loading season history...</div>';
        historyContainer.classList.add('expanded');
        
        const games = await fetchSeasonHistory();
        displaySeasonHistory(games);
    });
    
    leagueCard.addEventListener('click', async () => {
        if (leagueContainer.classList.contains('expanded')) {
            leagueContainer.classList.remove('expanded');
            return;
        }
        
        // Close season history if open
        historyContainer.classList.remove('expanded');
        
        const standingsDiv = leagueContainer.querySelector('.standings-content');
        
        standingsDiv.innerHTML = '<div class="loading">Loading standings...</div>';
        
        leagueContainer.classList.add('expanded');
        
        // Fetch and display data
        const [rankings, teamStats] = await Promise.all([
            getTeamRankings(),
            getTeamStats()
        ]);

        // Add standings toggle functionality
        const standingsToggle = leagueContainer.querySelector('.standings-toggle');
        let currentView = 'division';
        
        function updateStandingsView(view, standings, teamStats) {
            if (!standings) return;
            if (view === 'rankings' && teamStats) {
                if (!teamStats || !teamStats.stats || !teamStats.rankings || !teamStats.averages) {
                    standingsDiv.innerHTML = '<div class="error-message">No rankings data available.</div>';
                    return;
                }
                const { stats, rankings: statRankings, averages } = teamStats;
                const statList = [
                    { key: 'homeRuns', label: 'Home Runs', value: stats.homeRuns, avg: averages.homeRuns, rank: statRankings.homeRuns },
                    { key: 'runs', label: 'Runs', value: stats.runs, avg: averages.runs, rank: statRankings.runs },
                    { key: 'hits', label: 'Hits', value: stats.hits, avg: averages.hits, rank: statRankings.hits },
                    { key: 'era', label: 'ERA', value: stats.era, avg: averages.era, rank: statRankings.era },
                    { key: 'strikeOuts', label: 'Strikeouts', value: stats.strikeOuts, avg: averages.strikeOuts, rank: statRankings.strikeOuts },
                ];
                standingsDiv.innerHTML = `
                    <div class="team-rankings-list">
                        <h3>Team Rankings</h3>
                        <ul class="rankings-list-vertical">
                            ${statList.map(stat => `
                                <li class="ranking-item-vertical">
                                    <span class="stat-label">${stat.label}:</span>
                                    <span class="stat-value">${stat.value}</span>
                                    <span class="stat-avg">MLB Avg: ${stat.avg}</span>
                                    <span class="stat-rank">Rank: ${stat.rank}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `;
                return;
            }
            const teams = view === 'division' 
                ? standings.divisionStandings
                : standings.allTeams;
            
            standingsDiv.innerHTML = `
                <div class="standings-scroll">
                    <div class="standings-list">
                        <div class="standings-header">
                            <span class="rank-header">#</span>
                            <span class="team-header">Team</span>
                            <span class="record-header">W-L</span>
                            <span class="gb-header">GB</span>
                            <span class="pct-header">PCT</span>
                            <span class="streak-header">Streak</span>
                        </div>
                        ${teams.map((team, index) => {
                            if (!team || !team.teamName) return '';
                            const winPct = (team.wins / (team.wins + team.losses)).toFixed(3);
                            const isBraves = team.team.id === BRAVES_ID;
                            const logoUrl2 = getTeamLogoUrl(team.teamName);
                            return `
                                <div class="standings-row ${isBraves ? 'braves' : ''}">
                                    <span class="rank-number">${index + 1}</span>
                                    <span class="team-name">
                                        ${logoUrl2 ? `<img src="${logoUrl2}" alt="${team.teamName}" class="team-mini-logo" onerror="this.style.display='none'">` : ''}
                                        <span>${getTeamNameWithoutCity(team.teamName)}</span>
                                    </span>
                                    <span class="team-record">${team.wins}-${team.losses}</span>
                                    <span class="games-back">${team.gamesBack === '0.0' ? '-' : team.gamesBack}</span>
                                    <span class="win-pct">${winPct}</span>
                                    <span class="team-streak ${team.streak?.streakCode?.startsWith('W') ? 'winning' : 'losing'}">${team.streak?.streakCode || ''}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }
        
        standingsToggle.addEventListener('click', (e) => {
            if (e.target.classList.contains('toggle-btn')) {
                const view = e.target.dataset.view;
                if (view !== currentView) {
                    currentView = view;
                    standingsToggle.querySelectorAll('.toggle-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.view === view);
                    });
                    if (view === 'rankings') {
                        let teamStatsRaw = null;
                        if (teamStats) {
                            teamStatsRaw = teamStats;
                        }
                        updateStandingsView(view, rankings, teamStatsRaw);
                    } else {
                        updateStandingsView(view, rankings);
                    }
                }
            }
        });
        
        // Initial standings display
        let teamStatsRaw = null;
        if (teamStats) {
            teamStatsRaw = teamStats;
        }
        updateStandingsView('division', rankings, teamStatsRaw);
    });
}

// Update getTeamStats to include averages and runs
async function getTeamStats() {
    try {
        // Fetch hitting stats
        const hittingStats = await fetchMLBData(
            `teams/stats?stats=season&group=hitting&season=${CURRENT_SEASON}&sportIds=1`
        );
        
        // Fetch pitching stats
        const pitchingStats = await fetchMLBData(
            `teams/stats?stats=season&group=pitching&season=${CURRENT_SEASON}&sportIds=1`
        );
        
        console.log('Pitching stats response:', pitchingStats); // Debug log
        
        // Process hitting stats
        const allTeamHitting = hittingStats.stats[0].splits.map(team => ({
            teamId: team.team.id,
            homeRuns: team.stat.homeRuns || 0,
            hits: team.stat.hits || 0,
            runs: team.stat.runs || 0
        }));
        
        // Process pitching stats
        const allTeamPitching = pitchingStats.stats[0].splits.map(team => ({
            teamId: team.team.id,
            era: parseFloat(team.stat.era) || 0,
            strikeOuts: team.stat.strikeOuts || 0
        }));
        
        // Calculate averages
        const calculateAverage = (arr, prop) => {
            const sum = arr.reduce((acc, curr) => acc + (curr[prop] || 0), 0);
            return (sum / arr.length).toFixed(2);
        };

        const averages = {
            homeRuns: calculateAverage(allTeamHitting, 'homeRuns'),
            hits: calculateAverage(allTeamHitting, 'hits'),
            runs: calculateAverage(allTeamHitting, 'runs'),
            era: calculateAverage(allTeamPitching, 'era'),
            strikeOuts: calculateAverage(allTeamPitching, 'strikeOuts')
        };

        // Find Braves' stats and rankings
        const bravesHitting = allTeamHitting.find(team => team.teamId === BRAVES_ID);
        const bravesPitching = allTeamPitching.find(team => team.teamId === BRAVES_ID);
        
        // Sort teams for rankings
        const sortedHR = [...allTeamHitting].sort((a, b) => b.homeRuns - a.homeRuns);
        const sortedHits = [...allTeamHitting].sort((a, b) => b.hits - a.hits);
        const sortedRuns = [...allTeamHitting].sort((a, b) => b.runs - a.runs);
        const sortedERA = [...allTeamPitching].sort((a, b) => a.era - b.era);
        const sortedSO = [...allTeamPitching].sort((a, b) => b.strikeOuts - a.strikeOuts);
        
        // Format ERA with proper error handling
        const formatERA = (era) => {
            if (typeof era === 'number' && !isNaN(era)) {
                return era.toFixed(2);
            }
            return '0.00';
        };
        
        return {
            stats: {
                homeRuns: bravesHitting?.homeRuns || 0,
                hits: bravesHitting?.hits || 0,
                runs: bravesHitting?.runs || 0,
                era: formatERA(bravesPitching?.era),
                strikeOuts: bravesPitching?.strikeOuts || 0
            },
            rankings: {
                homeRuns: getOrdinalSuffix(sortedHR.findIndex(team => team.teamId === BRAVES_ID) + 1),
                hits: getOrdinalSuffix(sortedHits.findIndex(team => team.teamId === BRAVES_ID) + 1),
                runs: getOrdinalSuffix(sortedRuns.findIndex(team => team.teamId === BRAVES_ID) + 1),
                era: getOrdinalSuffix(sortedERA.findIndex(team => team.teamId === BRAVES_ID) + 1),
                strikeOuts: getOrdinalSuffix(sortedSO.findIndex(team => team.teamId === BRAVES_ID) + 1)
            },
            averages,
            allTeamHitting: allTeamHitting.map(team => ({
                ...team,
                teamName: team.team?.name || team.teamName || '',
                teamAbbr: getTeamAbbreviation(team.team?.name || team.teamName || ''),
            })),
            allTeamPitching: allTeamPitching.map(team => ({
                ...team,
                teamName: team.team?.name || team.teamName || '',
                teamAbbr: getTeamAbbreviation(team.team?.name || team.teamName || ''),
            })),
        };
    } catch (error) {
        console.error('Error getting team stats:', error);
        return {
            stats: {
                homeRuns: 0,
                hits: 0,
                runs: 0,
                era: '0.00',
                strikeOuts: 0
            },
            rankings: {
                homeRuns: '-',
                hits: '-',
                runs: '-',
                era: '-',
                strikeOuts: '-'
            },
            averages: {
                homeRuns: '0',
                hits: '0',
                runs: '0',
                era: '0.00',
                strikeOuts: '0'
            },
            allTeamHitting: [],
            allTeamPitching: []
        };
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

        // Get rankings
        const rankings = await getTeamRankings();
        
        const stats = {
            record: bravesRecord ? 
                `${bravesRecord.wins}-${bravesRecord.losses} (.${calculateWinningPercentage(bravesRecord.wins, bravesRecord.losses)})` : 
                'TBD',
            rankings: rankings ? `${rankings.divisionRank} • ${rankings.overallRank}` : 'Loading...',
            homeRuns: bravesRecord?.homeRuns || 0,
            divisionRank: rankings ? rankings.divisionRank : '',
            overallRank: rankings ? rankings.overallRank : '',
        };

        updateStatsDisplay(stats);
    } catch (error) {
        console.error('Error updating team stats:', error);
        updateStatsDisplay({
            record: 'Error',
            rankings: 'Error',
            homeRuns: '-'
        });
    }
}

// Update getTeamAbbreviation to use cityTeamMap
function getTeamAbbreviation(teamName) {
    return cityTeamMap[teamName] || '';
} 