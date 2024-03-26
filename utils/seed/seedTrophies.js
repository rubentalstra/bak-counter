const { Trophy } = require('../../models');


const defaultTrophies = [
    {
        name: 'Junior',
        description: 'Awarded for reaching Junior level in XP.',
        trophyImage: '/images/trophies/Junior.png'
    },
    {
        name: 'Senior',
        description: 'Awarded for reaching Senior level in XP.',
        trophyImage: '/images/trophies/Senior.png'
    },
    {
        name: 'Master',
        description: 'Awarded for mastering a skill with high XP.',
        trophyImage: '/images/trophies/Master.png'
    },
    {
        name: 'Alcoholist',
        description: 'Awarded for an exceptional contribution to the community.',
        trophyImage: '/images/trophies/Alcoholist.png'
    },
    {
        name: 'Leverfalen',
        description: 'Awarded for legendary status in XP.',
        trophyImage: '//images/trophies/Leverfalen.png'
    },
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
