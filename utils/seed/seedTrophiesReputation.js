const { Trophy } = require('../../models');


const defaultTrophies = [
    {
        name: 'Strooier',
        description: 'Met elke overwinning strooi je gulzig alcoholische schulden over je tegenstanders heen, wat je de afgunst van allen oplevert.',
        trophyImage: '/images/reputation/Strooier.webp'
    },
    {
        name: 'Mormel',
        description: 'Listig en veerkrachtig, gedij je te midden van de groeiende afkeer van anderen terwijl je weddenschap na weddenschap wint.',
        trophyImage: '/images/reputation/Mormel.webp'
    },
    {
        name: 'Schoft',
        description: 'Dapper en zegevierend, verhoogt elke overwinning de inzet en vergroot het ressentiment van degenen die je hebt verslagen.',
        trophyImage: '/images/reputation/Schoft.webp'
    },
    {
        name: 'Klootzak',
        description: 'Op het hoogtepunt van dominantie stapelen je overwinningen zich op, en bij elke overwinning verdiept de verbittering van je tegenstanders.',
        trophyImage: '/images/reputation/Klootzak.webp'
    }
];

async function seedTrophies() {
    try {
        await Trophy.bulkCreate(defaultTrophies);
        console.log('Trophies have been inserted successfully.');
    } catch (error) {
        console.error('Failed to insert trophies:', error);
    }
}

seedTrophies();
