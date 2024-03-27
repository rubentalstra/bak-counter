async function xpOrRepIfEligible(userId) {
    const { xpLevels, levelNames, repTiers, reputationNames } = require("../../config/milestones");
    const { User, Trophy, UserTrophies } = require("../../models/index");

    const user = await User.findByPk(userId);
    // console.log(`Checking trophies for user ${user.name} with XP: ${user.xp} and REP: ${user.rep}`);

    // Function to find the index of the level or tier the user falls into
    const findMilestoneIndex = (value, milestones) => milestones.findIndex((milestone, index) => value >= milestone && (index === milestones.length - 1 || value < milestones[index + 1]));

    // Determine XP and REP milestone indices
    const xpIndex = findMilestoneIndex(user.xp, xpLevels);
    const repIndex = findMilestoneIndex(user.rep, repTiers);

    const xpTrophyName = xpIndex > 0 ? levelNames[xpIndex] : null;
    const repTrophyName = repIndex > 0 ? reputationNames[repIndex] : null;

    // console.log(`Determined XP trophy: ${xpTrophyName}, REP trophy: ${repTrophyName}`);

    // Helper function to award trophies
    const awardTrophyByName = async (userId, trophyName) => {
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
                    // console.log(`Awarded ${trophyName} trophy to user ${user.name}.`);
                } else {
                    // console.log(`User ${user.name} already has the ${trophyName} trophy.`);
                }
            } else {
                console.log(`Trophy ${trophyName} not found in the database.`);
            }
        }
    };

    // Attempt to award XP and REP based trophies
    await awardTrophyByName(userId, xpTrophyName);
    await awardTrophyByName(userId, repTrophyName);
}

module.exports = { xpOrRepIfEligible };
