const { User } = require("../models");



describe('User XP Update and Trophy Awarding', () => {
    it('should award a Junior trophy when user XP reaches 10', async () => {
        // Assuming a user with ID 1 exists
        const userId = 1;
        const user = await User.findByPk(userId);

        // Increase the user's XP to 10
        await user.update({ xp: 10 });

        // Find any trophies awarded to this user with the name 'Junior'
        const trophyAwarded = await user.getTrophies({ where: { name: 'Junior' } });

        // Assert that a trophy named 'Junior' was awarded
        expect(trophyAwarded.length).toBeGreaterThan(0);
    });
});
