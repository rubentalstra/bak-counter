-- SQLite
SELECT id, googleId, email, name, bak, createdAt, updatedAt
FROM Users;

INSERT INTO Users (googleId, email, name, createdAt, updatedAt)
VALUES ('108169335721945492515', 'test@test.nl', 'Test', strftime('%Y-%m-%d %H:%M:%S', datetime('now')), strftime('%Y-%m-%d %H:%M:%S', datetime('now')));

update Users set xp = 24 where id = 1


delete from BakHasTakenRequest where id = 1

update BakHasTakenRequest set firstApproverId = 2 where id = 7

update Bets set judgeUserId = 1 where betId = 1