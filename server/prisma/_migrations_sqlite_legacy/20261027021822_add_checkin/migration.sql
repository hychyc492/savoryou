-- CreateTable
CREATE TABLE "Checkin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "targetId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Checkin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Checkin_targetId_date_idx" ON "Checkin"("targetId", "date");

-- CreateIndex
CREATE INDEX "Checkin_date_idx" ON "Checkin"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Checkin_userId_targetId_date_key" ON "Checkin"("userId", "targetId", "date");
