const xpLevels = [0, 10, 25, 50, 100, 200]; // XP milestones
const repTiers = [0, 10, 25, 50, 100]; // REP milestones
const levelNames = ['Loser', 'Junior', 'Senior', 'Master', 'Alcoholist', 'Leverfalen'];
const reputationNames = ['Neutral', 'Strooier', 'Mormel', 'Schoft', 'Klootzak'];
const xpBadges = ['', 'normal', 'gray', 'bronze', 'zilver', 'gold'];
const repBadges = ['', 'normal', 'gray', 'bronze', 'zilver', 'gold'];

function getUserLevelDetails(xp) {
    let levelIndex = xpLevels.findIndex(level => xp < level) - 1;
    if (levelIndex === -2) levelIndex = xpLevels.length - 1; // Handles max level case
    const nextXPLevel = levelIndex + 1 < xpLevels.length ? xpLevels[levelIndex + 1] : null;
    const xpPercentage = nextXPLevel ? Math.round((xp / nextXPLevel) * 100) : 100;
    return {
        level: levelNames[levelIndex],
        nextXPLevel,
        xpPercentage,
        badge: xpBadges[levelIndex]
    };
}

function getUserReputationDetails(rep) {
    let repIndex = repTiers.findIndex(tier => rep < tier) - 1;
    if (repIndex === -2) repIndex = repTiers.length - 1; // Handles max rep case
    const nextRepTier = repIndex + 1 < repTiers.length ? repTiers[repIndex + 1] : null;
    const repPercentage = nextRepTier ? Math.round((rep / nextRepTier) * 100) : 100;
    return {
        reputation: reputationNames[repIndex],
        nextRepTier,
        repPercentage,
        badge: repBadges[repIndex]
    };
}

module.exports = { getUserLevelDetails, getUserReputationDetails };
