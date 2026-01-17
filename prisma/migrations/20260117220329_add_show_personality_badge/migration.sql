-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nickname" TEXT,
    "bio" TEXT,
    "avatar" TEXT,
    "banner" TEXT,
    "lastUsernameChange" DATETIME,
    "country" TEXT,
    "city" TEXT,
    "pronouns" TEXT,
    "birthday" TEXT,
    "website" TEXT,
    "socialLinks" TEXT,
    "status" TEXT,
    "themeColor" TEXT,
    "interests" TEXT,
    "personalityBadge" TEXT,
    "showPersonalityBadge" BOOLEAN NOT NULL DEFAULT true,
    "notificationSoundsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "browserNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "steamUsername" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("avatar", "banner", "bio", "birthday", "browserNotificationsEnabled", "city", "country", "createdAt", "email", "id", "interests", "lastUsernameChange", "nickname", "notificationSoundsEnabled", "password", "personalityBadge", "pronouns", "socialLinks", "status", "steamUsername", "themeColor", "updatedAt", "username", "website") SELECT "avatar", "banner", "bio", "birthday", "browserNotificationsEnabled", "city", "country", "createdAt", "email", "id", "interests", "lastUsernameChange", "nickname", "notificationSoundsEnabled", "password", "personalityBadge", "pronouns", "socialLinks", "status", "steamUsername", "themeColor", "updatedAt", "username", "website" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
