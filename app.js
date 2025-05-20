// Sample data - In a real application, this would come from an API
const teamStats = {
    seasonRecord: '104-58',
    teamAvg: '.276',
    teamERA: '3.78'
};

const upcomingGames = [
    {
        date: '2024-04-01',
        opponent: 'Philadelphia Phillies',
        time: '7:20 PM ET',
        location: 'Home'
    },
    {
        date: '2024-04-02',
        opponent: 'Philadelphia Phillies',
        time: '7:20 PM ET',
        location: 'Home'
    },
    {
        date: '2024-04-03',
        opponent: 'Philadelphia Phillies',
        time: '7:20 PM ET',
        location: 'Home'
    }
];

const roster = [
    {
        name: 'Ronald Acuña Jr.',
        position: 'RF',
        number: '13'
    },
    {
        name: 'Matt Olson',
        position: '1B',
        number: '28'
    },
    {
        name: 'Austin Riley',
        position: '3B',
        number: '27'
    },
    // Add more players as needed
];

// Update team stats
document.getElementById('season-record').textContent = teamStats.seasonRecord;
document.getElementById('team-avg').textContent = teamStats.teamAvg;
document.getElementById('team-era').textContent = teamStats.teamERA;

// Populate upcoming games
const upcomingGamesContainer = document.getElementById('upcoming-games');
upcomingGames.forEach(game => {
    const gameCard = document.createElement('div');
    gameCard.className = 'stat-card';
    gameCard.innerHTML = `
        <h3>${game.opponent}</h3>
        <p>${new Date(game.date).toLocaleDateString()}</p>
        <p>${game.time}</p>
        <p>${game.location}</p>
    `;
    upcomingGamesContainer.appendChild(gameCard);
});

// Populate roster
const rosterContainer = document.getElementById('player-roster');
roster.forEach(player => {
    const playerCard = document.createElement('div');
    playerCard.className = 'stat-card';
    playerCard.innerHTML = `
        <h3>${player.name}</h3>
        <p>#${player.number} | ${player.position}</p>
    `;
    rosterContainer.appendChild(playerCard);
});

// Add loading state handling
document.addEventListener('DOMContentLoaded', () => {
    // In a real application, this is where you would fetch data from an API
    console.log('Dashboard loaded successfully');
}); 