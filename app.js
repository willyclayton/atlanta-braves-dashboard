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
    'Left Fielder': { abbr: 'LF', label: 'Left Field', number: '7' },
    'Center Fielder': { abbr: 'CF', label: 'Center Field', number: '8' },
    'Right Fielder': { abbr: 'RF', label: 'Right Field', number: '9' },
    // Add aliases for possible API variations
    'Outfield': { abbr: 'OF', label: 'Outfield', number: '7/8/9' },
    'Outfielder': { abbr: 'OF', label: 'Outfield', number: '7/8/9' }
};

// Store roster data globally for position clicks
let currentRosterData = null;
let activePosition = null;
let playerStats = new Map();

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

        // Get last 5 completed games
        const scheduleData = await fetchMLBData(`schedule/games/?sportId=1&teamId=${BRAVES_ID}&season=${year}&gameTypes=R,F&scheduleTypes=games,events,xref&hydrate=decisions,probablePitcher(note),linescore&fields=dates,games,status,teams,isWinner,score`);
        
        // Filter and sort games by date, most recent first
        const completedGames = scheduleData.dates
            .flatMap(date => date.games)
            .filter(game => game.status.statusCode === 'F')  // Only completed games
            .sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate))
            .slice(0, 5);  // Take last 5 games

        let wins = 0;
        let losses = 0;
        let gamesCount = 0;

        completedGames.forEach(game => {
            const braves = game.teams.away.team.id === BRAVES_ID ? game.teams.away : game.teams.home;
            if (braves.isWinner) {
                wins++;
            } else {
                losses++;
            }
            gamesCount++;
        });

        const stats = {
            record: bravesRecord ? `${bravesRecord.wins}-${bravesRecord.losses}` : 'TBD',
            last5: gamesCount > 0 ? `${wins}-${losses}` : 'No games',
            homeRuns: teamStats.homeRuns || 0
        };

        updateStatsDisplay(stats);
    } catch (error) {
        console.error('Error updating team stats:', error);
        updateStatsDisplay({
            record: 'Error',
            last5: '-',
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
        
        const positionList = document.getElementById('position-list');
        
        if (!data.roster || !data.roster.length) {
            positionList.innerHTML = '<p class="error-message">No roster data available</p>';
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

        console.log('Final player stats map:', playerStats);

        // Group players by position
        const playersByPosition = {};
        data.roster.forEach(player => {
            let position = player.position.name;
            
            if (position === 'Outfield' || position === 'Outfielder') {
                const specificPosition = player.position.type === 'Specific' ? player.position.name : null;
                if (specificPosition && POSITION_MAP[specificPosition]) {
                    position = specificPosition;
                }
            }
            
            if (!playersByPosition[position]) {
                playersByPosition[position] = [];
            }
            playersByPosition[position].push(player);
        });

        // Create position list for standard positions
        const standardPositions = [
            'Pitcher', 'Catcher', 'First Base', 'Second Base', 'Third Base', 
            'Shortstop', 'Left Fielder', 'Center Fielder', 'Right Fielder'
        ];

        positionList.innerHTML = standardPositions
            .map(position => {
                const info = POSITION_MAP[position];
                const players = playersByPosition[position] || [];
                
                if (['Left Fielder', 'Center Fielder', 'Right Fielder'].includes(position)) {
                    const genericOutfielders = playersByPosition['Outfield'] || [];
                    players.push(...genericOutfielders);
                }

                return `
                    <li class="position-item">
                        <button class="position-button" data-position="${position}">
                            <span class="position-number">${info.number}</span>
                            <span class="position-name">${info.label}</span>
                            <span class="position-count">${players.length}</span>
                        </button>
                    </li>
                `;
            })
            .join('');

        // Add click handlers to position buttons
        positionList.querySelectorAll('.position-button').forEach(button => {
            button.addEventListener('click', handlePositionClick);
        });

    } catch (error) {
        console.error('Error updating roster:', error);
        document.getElementById('position-list').innerHTML = 
            '<p class="error-message">Error loading roster data</p>';
    }
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
        avg: avg ? avg.toFixed(3).replace(/^0/, '') : '.---',
        hits: hittingStats.hits || 0,
        rbi: hittingStats.rbi || 0,
        era: era ? era.toFixed(2) : '-.--',
        wins: pitchingStats.wins || 0,
        losses: pitchingStats.losses || 0,
        saves: pitchingStats.saves || 0,
        strikeOuts: pitchingStats.strikeOuts || 0
    };
}

// Handle position button clicks
function handlePositionClick(event) {
    const button = event.currentTarget;
    const position = button.dataset.position;
    const playerDetails = document.getElementById('player-details');

    // Update active state
    document.querySelectorAll('.position-button').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');

    // If clicking the same position, just toggle visibility
    if (activePosition === position) {
        playerDetails.classList.toggle('expanded');
        if (!playerDetails.classList.contains('expanded')) {
            activePosition = null;
            button.classList.remove('active');
        }
        return;
    }

    // Update active position
    activePosition = position;

    // Get players for this position
    let players = currentRosterData.roster.filter(
        player => player.position.name === position
    );

    // For outfield positions, also include generic outfielders
    if (['Left Fielder', 'Center Fielder', 'Right Fielder'].includes(position)) {
        const genericOutfielders = currentRosterData.roster.filter(
            player => ['Outfield', 'Outfielder'].includes(player.position.name)
        );
        players = [...players, ...genericOutfielders];
    }

    console.log(`Displaying players for ${position}:`, players);

    // Update player details with stats
    playerDetails.innerHTML = `
        <h3>${POSITION_MAP[position].label} Players</h3>
        <div class="player-list">
            ${players.map(player => {
                const stats = playerStats.get(player.person.id);
                console.log(`Stats for ${player.person.fullName}:`, stats);
                const isPitcher = position === 'Pitcher';
                
                return `
                    <div class="player-card">
                        <span class="player-number">#${player.jerseyNumber || '??'}</span>
                        <div class="player-info">
                            <div class="player-name">${player.person.fullName}</div>
                            ${player.status?.description ? 
                                `<div class="player-status">${player.status.description}</div>` : 
                                ''}
                            ${player.position.name === 'Outfield' || player.position.name === 'Outfielder' ?
                                `<div class="player-position">General Outfielder</div>` :
                                ''}
                            <div class="player-stats">
                                ${isPitcher ? `
                                    <span class="stat">ERA: ${stats?.era || '-.--'}</span>
                                    <span class="stat">W-L: ${stats?.wins || 0}-${stats?.losses || 0}</span>
                                    <span class="stat">SO: ${stats?.strikeOuts || 0}</span>
                                    <span class="stat">SV: ${stats?.saves || 0}</span>
                                ` : `
                                    <span class="stat">AVG: ${stats?.avg || '.---'}</span>
                                    <span class="stat">H: ${stats?.hits || 0}</span>
                                    <span class="stat">RBI: ${stats?.rbi || 0}</span>
                                `}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    // Show player details with animation
    playerDetails.classList.add('expanded');
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

        // Get current date and start of the current week
        const today = new Date();
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(today.getDate() - today.getDay()); // Start from Sunday
        currentWeekStart.setHours(0, 0, 0, 0);

        // Create a map of games by date string
        const gamesByDate = new Map();
        data.dates.forEach(date => {
            date.games.forEach(game => {
                const gameDate = new Date(game.gameDate);
                const dateStr = gameDate.toDateString();
                gamesByDate.set(dateStr, game);
            });
        });

        // Generate 14 days (2 weeks) of calendar
        let calendarHTML = '';
        for (let i = 0; i < 14; i++) {
            const currentDate = new Date(currentWeekStart);
            currentDate.setDate(currentWeekStart.getDate() + i);
            const dateStr = currentDate.toDateString();
            const game = gamesByDate.get(dateStr);
            
            // Add week separator
            if (i === 0) {
                calendarHTML += '<div class="week-label">This Week</div>';
            } else if (i === 7) {
                calendarHTML += '<div class="week-label">Next Week</div>';
            }
            
            const isToday = currentDate.toDateString() === today.toDateString();
            
            let dayClasses = ['calendar-day'];
            if (isToday) dayClasses.push('today');
            if (game) dayClasses.push('has-game');

            let gameHTML = '';
            if (game) {
                const gameDate = new Date(game.gameDate);
                const isHome = game.teams.home.team.id === BRAVES_ID;
                const opponent = isHome ? game.teams.away.team : game.teams.home.team;
                
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
                                `<span class="home-indicator"></span> vs ${opponent.name}` : 
                                `@ ${opponent.name}`
                            }
                        </div>
                    </div>
                `;
            }

            calendarHTML += `
                <div class="${dayClasses.join(' ')}">
                    <div class="day-header">
                        <span class="day-name">${currentDate.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        <span class="day-number">${currentDate.getDate()}</span>
                    </div>
                    ${gameHTML}
                </div>
            `;
        }

        gamesContainer.innerHTML = calendarHTML;
    } catch (error) {
        console.error('Error updating schedule:', error);
        document.getElementById('upcoming-games').innerHTML = 
            '<p class="error-message">Error loading schedule data</p>';
    }
}

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
}); 