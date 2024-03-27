async function xpOrRepIfEligible(userId) {
    const { xpLevels, levelNames, repTiers, reputationNames } = require("../../config/milestones");
    const { User, Trophy, UserTrophies } = require("../../models/index");

    const user = await User.findByPk(userId);

    const findMilestoneIndex = (value, milestones) => milestones.findIndex((milestone, index) => value >= milestone && (index === milestones.length - 1 || value < milestones[index + 1]));

    const xpIndex = findMilestoneIndex(user.xp, xpLevels);
    const repIndex = findMilestoneIndex(user.rep, repTiers);

    // Helper function to award multiple trophies
    const awardTrophiesByNames = async (userId, trophyNames) => {
        for (const trophyName of trophyNames) {
            if (trophyName) {
                const trophy = await Trophy.findOne({ where: { name: trophyName } });
                if (trophy) {
                    const existingAward = await UserTrophies.findOne({
                        where: {
                            userId: userId,
                            trophyId: trophy.id
                        }
                    });

                    if (!existingAward) {
                        await UserTrophies.create({
                            userId: userId,
                            trophyId: trophy.id,
                        });
                    }
                } else {
                    console.log(`Trophy ${trophyName} not found in the database.`);
                }
            }
        }
    };

    // Function to get all missed trophies
    const getAllMissedTrophies = (currentIndex, names) => {
        return names.filter((_, index) => index <= currentIndex && index > 0);
    };

    // Attempt to award XP and REP based trophies including missed ones
    const missedXpTrophies = getAllMissedTrophies(xpIndex, levelNames);
    const missedRepTrophies = getAllMissedTrophies(repIndex, reputationNames);

    await awardTrophiesByNames(userId, missedXpTrophies);
    await awardTrophiesByNames(userId, missedRepTrophies);
}

module.exports = { xpOrRepIfEligible };
