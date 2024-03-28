const { Trophy } = require('../../models');

const defaultTrophies = [
    {
        name: 'Trek 1 bak',
        description: 'Proost op je eerste tocht! Toegekend voor het beheersen van één "bak" met finesse.',
        trophyImage: '/images/back-to-back/1.webp'
    },
    {
        name: 'Trek 2 bakken',
        description: 'Je hebt het plezier verdubbeld! Toegekend voor het beheren van twee "bakken" achter elkaar.',
        trophyImage: '/images/back-to-back/2.webp'
    },
    {
        name: 'Trek 3 bakken',
        description: 'Drie is een feestje! Toegekend voor het veroveren van drie "bakken" achter elkaar.',
        trophyImage: '/images/back-to-back/3.webp'
    },
    {
        name: 'Trek 4 bakken',
        description: 'Verdediger van de uitdaging! Toegekend voor veerkracht bij het aangaan van vier "bakken" achter elkaar.',
        trophyImage: '/images/back-to-back/4.webp'
    },
    {
        name: 'Trek 5 bakken',
        description: 'Kracht in eenheid! Toegekend voor het beheersen van vijf "bakken" achter elkaar.',
        trophyImage: '/images/back-to-back/5.webp'
    },
    {
        name: 'Trek 6 bakken',
        description: 'Onderlinge veerkracht! Toegekend voor het aangaan van zes "bakken" achter elkaar.',
        trophyImage: '/images/back-to-back/6.webp'
    },
    {
        name: 'Trek 7 bakken',
        description: 'Geëerde presteerder! Toegekend voor het volbrengen van zeven "bakken" achter elkaar.',
        trophyImage: '/images/back-to-back/7.webp'
    },
    {
        name: 'Trek 8 bakken',
        description: 'Diverse veerkracht! Toegekend voor meesterschap bij het aangaan van acht "bakken" achter elkaar.',
        trophyImage: '/images/back-to-back/8.webp'
    },
    {
        name: 'Trek 9 bakken',
        description: 'Bijna daar! Toegekend voor bijna voltooien van negen "bakken" achter elkaar.',
        trophyImage: '/images/back-to-back/9.webp'
    },
    {
        name: 'Trek 10 bakken',
        description: 'Meester van de uitdaging! Toegekend voor het meesteren van tien "bakken" achter elkaar.',
        trophyImage: '/images/back-to-back/10.webp'
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
