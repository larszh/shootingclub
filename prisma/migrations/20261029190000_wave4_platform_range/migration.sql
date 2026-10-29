-- AlterTable
ALTER TABLE `AmmoProduct` ADD COLUMN `fundingType` VARCHAR(191) NOT NULL DEFAULT 'COMMERCIAL';

-- AlterTable
ALTER TABLE `Match` ADD COLUMN `eventId` VARCHAR(191) NULL,
    ADD COLUMN `finishedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `MatchParticipant` ADD COLUMN `attempt` INTEGER NULL,
    ADD COLUMN `isOfficial` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `passed` BOOLEAN NULL,
    ADD COLUMN `total` DOUBLE NULL,
    ADD COLUMN `verifiedAt` DATETIME(3) NULL,
    ADD COLUMN `verifiedById` VARCHAR(191) NULL,
    ADD COLUMN `zeros` INTEGER NULL;

-- AlterTable
ALTER TABLE `Membership` ADD COLUMN `adminNote` TEXT NULL,
    ADD COLUMN `guardianEmail` VARCHAR(191) NULL,
    ADD COLUMN `guardianName` VARCHAR(191) NULL,
    ADD COLUMN `guardianPhone` VARCHAR(191) NULL,
    ADD COLUMN `householdId` VARCHAR(191) NULL,
    ADD COLUMN `joinedAt` DATE NULL,
    ADD COLUMN `leftAt` DATE NULL,
    ADD COLUMN `licenseNumber` VARCHAR(191) NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `workHoursExempt` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Program` ADD COLUMN `officialKind` VARCHAR(191) NULL,
    ADD COLUMN `passMaxZeros` INTEGER NULL,
    ADD COLUMN `passMinScore` DOUBLE NULL;

-- AlterTable
ALTER TABLE `Tenant` ADD COLUMN `defaultLocale` VARCHAR(191) NOT NULL DEFAULT 'de',
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `purgeAfter` DATETIME(3) NULL,
    ADD COLUMN `replyToEmail` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `birthDate` DATE NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `passwordSetAt` DATETIME(3) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `totpEnabledAt` DATETIME(3) NULL,
    ADD COLUMN `totpSecretEnc` TEXT NULL;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NULL,
    `actorName` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `detail` TEXT NULL,
    `ip` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `AuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AuthToken_tokenHash_key`(`tokenHash`),
    INDEX `AuthToken_userId_kind_idx`(`userId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invitation` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'MEMBER',
    `tokenHash` VARCHAR(191) NOT NULL,
    `invitedById` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `acceptedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Invitation_tokenHash_key`(`tokenHash`),
    INDEX `Invitation_tenantId_email_idx`(`tenantId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MailMessage` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `kind` VARCHAR(191) NULL,
    `toEmail` VARCHAR(191) NOT NULL,
    `toName` VARCHAR(191) NULL,
    `replyTo` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `html` MEDIUMTEXT NOT NULL,
    `text` MEDIUMTEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `sendAfter` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,
    `dedupeKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MailMessage_dedupeKey_key`(`dedupeKey`),
    INDEX `MailMessage_status_sendAfter_idx`(`status`, `sendAfter`),
    INDEX `MailMessage_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JobLock` (
    `name` VARCHAR(191) NOT NULL,
    `lockedUntil` DATETIME(3) NULL,
    `lastRunAt` DATETIME(3) NULL,
    `lastStatus` VARCHAR(191) NULL,
    `lastError` TEXT NULL,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PushSubscription` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `endpointHash` VARCHAR(191) NOT NULL,
    `endpoint` TEXT NOT NULL,
    `p256dh` VARCHAR(191) NOT NULL,
    `auth` VARCHAR(191) NOT NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUsedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PushSubscription_endpointHash_key`(`endpointHash`),
    INDEX `PushSubscription_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationPreference` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `topic` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `NotificationPreference_userId_channel_topic_key`(`userId`, `channel`, `topic`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Household` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `payerUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Household_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Qualification` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `number` VARCHAR(191) NULL,
    `validFrom` DATE NULL,
    `validUntil` DATE NULL,
    `verifiedById` VARCHAR(191) NULL,
    `sourceParticipantId` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Qualification_tenantId_kind_idx`(`tenantId`, `kind`),
    INDEX `Qualification_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QualificationRule` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `programId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'WEAPON_QUAL',
    `passScore` DOUBLE NOT NULL,
    `maxZeros` INTEGER NULL,
    `validityMonths` INTEGER NOT NULL DEFAULT 12,
    `requireInstructor` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QualificationRule_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shift` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `capacity` INTEGER NOT NULL DEFAULT 1,
    `requiredQualification` VARCHAR(191) NULL,
    `hoursCredit` DOUBLE NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Shift_tenantId_startsAt_idx`(`tenantId`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShiftAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `shiftId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ASSIGNED',
    `hours` DOUBLE NULL,
    `confirmedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ShiftAssignment_userId_idx`(`userId`),
    UNIQUE INDEX `ShiftAssignment_shiftId_userId_key`(`shiftId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkHoursSettings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `requiredHours` DOUBLE NOT NULL DEFAULT 0,
    `ratePerMissingHourCents` INTEGER NOT NULL DEFAULT 0,
    `appliesToStatuses` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WorkHoursSettings_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkLog` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `hours` DOUBLE NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkLog_tenantId_date_idx`(`tenantId`, `date`),
    INDEX `WorkLog_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Championship` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `startsOn` DATE NOT NULL,
    `endsOn` DATE NOT NULL,
    `bestOf` INTEGER NULL,
    `officialOnly` BOOLEAN NOT NULL DEFAULT false,
    `categoriesText` TEXT NULL,
    `rulesText` TEXT NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Championship_tenantId_year_idx`(`tenantId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChampionshipProgram` (
    `id` VARCHAR(191) NOT NULL,
    `championshipId` VARCHAR(191) NOT NULL,
    `programId` VARCHAR(191) NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT false,
    `weight` DOUBLE NOT NULL DEFAULT 1,
    `maxCount` INTEGER NULL,

    UNIQUE INDEX `ChampionshipProgram_championshipId_programId_key`(`championshipId`, `programId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RangeDay` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NULL,
    `date` DATE NOT NULL,
    `dutyUserId` VARCHAR(191) NULL,
    `dutyName` VARCHAR(191) NULL,
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,
    `usedAm` BOOLEAN NOT NULL DEFAULT false,
    `usedPm` BOOLEAN NOT NULL DEFAULT false,
    `usedEvening` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RangeDay_tenantId_date_idx`(`tenantId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RangeVisit` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `rangeDayId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `guestName` VARCHAR(191) NULL,
    `guestEmail` VARCHAR(191) NULL,
    `guestPhone` VARCHAR(191) NULL,
    `guestBirthYear` INTEGER NULL,
    `guestIdChecked` BOOLEAN NOT NULL DEFAULT false,
    `hostUserId` VARCHAR(191) NULL,
    `lane` VARCHAR(191) NULL,
    `discipline` VARCHAR(191) NULL,
    `checkedInAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `checkedOutAt` DATETIME(3) NULL,
    `clubWeaponId` VARCHAR(191) NULL,
    `rulesId` VARCHAR(191) NULL,
    `rulesAcceptedAt` DATETIME(3) NULL,
    `clientId` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RangeVisit_clientId_key`(`clientId`),
    INDEX `RangeVisit_tenantId_checkedInAt_idx`(`tenantId`, `checkedInAt`),
    INDEX `RangeVisit_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RangeRules` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RangeRules_tenantId_version_key`(`tenantId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RulesAcceptance` (
    `id` VARCHAR(191) NOT NULL,
    `rulesId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RulesAcceptance_rulesId_userId_key`(`rulesId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShootingWindow` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NULL,
    `weekday` INTEGER NOT NULL,
    `startMinute` INTEGER NOT NULL,
    `endMinute` INTEGER NOT NULL,
    `note` VARCHAR(191) NULL,

    INDEX `ShootingWindow_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShootingQuota` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NULL,
    `year` INTEGER NOT NULL,
    `maxHalfDays` INTEGER NOT NULL,
    `note` VARCHAR(191) NULL,

    UNIQUE INDEX `ShootingQuota_tenantId_resourceId_year_key`(`tenantId`, `resourceId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Incident` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'NEAR_MISS',
    `severity` VARCHAR(191) NOT NULL DEFAULT 'LOW',
    `location` VARCHAR(191) NULL,
    `description` TEXT NOT NULL,
    `persons` TEXT NULL,
    `measures` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `reportedById` VARCHAR(191) NULL,
    `clientId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Incident_clientId_key`(`clientId`),
    INDEX `Incident_tenantId_occurredAt_idx`(`tenantId`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClubWeapon` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `discipline` VARCHAR(191) NULL,
    `manufacturer` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `caliber` VARCHAR(191) NULL,
    `serialNumber` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'AVAILABLE',
    `shotCount` INTEGER NOT NULL DEFAULT 0,
    `serviceEveryShots` INTEGER NULL,
    `nextServiceAt` DATE NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ClubWeapon_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeaponLoan` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `weaponId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `borrowerName` VARCHAR(191) NULL,
    `isMinor` BOOLEAN NOT NULL DEFAULT false,
    `onSiteOnly` BOOLEAN NOT NULL DEFAULT true,
    `loanedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueAt` DATETIME(3) NULL,
    `returnedAt` DATETIME(3) NULL,
    `shots` INTEGER NULL,
    `issuedById` VARCHAR(191) NULL,
    `reportDueAt` DATETIME(3) NULL,
    `reportedAt` DATETIME(3) NULL,
    `note` VARCHAR(191) NULL,

    INDEX `WeaponLoan_tenantId_loanedAt_idx`(`tenantId`, `loanedAt`),
    INDEX `WeaponLoan_weaponId_idx`(`weaponId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeaponService` (
    `id` VARCHAR(191) NOT NULL,
    `weaponId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'SERVICE',
    `note` VARCHAR(191) NULL,
    `costCents` INTEGER NULL,
    `byName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WeaponService_weaponId_idx`(`weaponId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AmmoStockMovement` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `units` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `rangeDayId` VARCHAR(191) NULL,
    `orderId` VARCHAR(191) NULL,
    `source` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AmmoStockMovement_tenantId_date_idx`(`tenantId`, `date`),
    INDEX `AmmoStockMovement_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Course` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'JUNGSCHUETZEN',
    `name` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `startsOn` DATE NULL,
    `endsOn` DATE NULL,
    `leaderUserId` VARCHAR(191) NULL,
    `minParticipants` INTEGER NULL,
    `requiredProgramIds` TEXT NULL,
    `notes` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PLANNED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Course_tenantId_year_idx`(`tenantId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CourseParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `birthDate` DATE NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `street` VARCHAR(191) NULL,
    `zip` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `guardianName` VARCHAR(191) NULL,
    `guardianEmail` VARCHAR(191) NULL,
    `guardianPhone` VARCHAR(191) NULL,
    `clubWeaponId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'REGISTERED',
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CourseParticipant_courseId_idx`(`courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CourseSession` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NULL,

    INDEX `CourseSession_courseId_startsAt_idx`(`courseId`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CourseAttendance` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `participantId` VARCHAR(191) NOT NULL,
    `present` BOOLEAN NOT NULL DEFAULT true,
    `note` VARCHAR(191) NULL,

    UNIQUE INDEX `CourseAttendance_sessionId_participantId_key`(`sessionId`, `participantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CourseResult` (
    `id` VARCHAR(191) NOT NULL,
    `participantId` VARCHAR(191) NOT NULL,
    `programId` VARCHAR(191) NULL,
    `label` VARCHAR(191) NOT NULL,
    `score` DOUBLE NULL,
    `passed` BOOLEAN NOT NULL DEFAULT false,
    `date` DATE NOT NULL,
    `matchParticipantId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CourseResult_participantId_idx`(`participantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LiveBoard` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `programId` VARCHAR(191) NULL,
    `eventId` VARCHAR(191) NULL,
    `date` DATE NULL,
    `showDecimals` BOOLEAN NOT NULL DEFAULT false,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LiveBoard_token_key`(`token`),
    INDEX `LiveBoard_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Match_eventId_idx` ON `Match`(`eventId`);

-- CreateIndex
CREATE INDEX `MatchParticipant_userId_isOfficial_idx` ON `MatchParticipant`(`userId`, `isOfficial`);

-- CreateIndex
CREATE INDEX `Membership_householdId_idx` ON `Membership`(`householdId`);

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_householdId_fkey` FOREIGN KEY (`householdId`) REFERENCES `Household`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthToken` ADD CONSTRAINT `AuthToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PushSubscription` ADD CONSTRAINT `PushSubscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationPreference` ADD CONSTRAINT `NotificationPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Household` ADD CONSTRAINT `Household_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Qualification` ADD CONSTRAINT `Qualification_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Qualification` ADD CONSTRAINT `Qualification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Qualification` ADD CONSTRAINT `Qualification_sourceParticipantId_fkey` FOREIGN KEY (`sourceParticipantId`) REFERENCES `MatchParticipant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QualificationRule` ADD CONSTRAINT `QualificationRule_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QualificationRule` ADD CONSTRAINT `QualificationRule_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shift` ADD CONSTRAINT `Shift_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shift` ADD CONSTRAINT `Shift_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftAssignment` ADD CONSTRAINT `ShiftAssignment_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `Shift`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftAssignment` ADD CONSTRAINT `ShiftAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkHoursSettings` ADD CONSTRAINT `WorkHoursSettings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkLog` ADD CONSTRAINT `WorkLog_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkLog` ADD CONSTRAINT `WorkLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Championship` ADD CONSTRAINT `Championship_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChampionshipProgram` ADD CONSTRAINT `ChampionshipProgram_championshipId_fkey` FOREIGN KEY (`championshipId`) REFERENCES `Championship`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChampionshipProgram` ADD CONSTRAINT `ChampionshipProgram_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RangeDay` ADD CONSTRAINT `RangeDay_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RangeDay` ADD CONSTRAINT `RangeDay_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `Resource`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RangeVisit` ADD CONSTRAINT `RangeVisit_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RangeVisit` ADD CONSTRAINT `RangeVisit_rangeDayId_fkey` FOREIGN KEY (`rangeDayId`) REFERENCES `RangeDay`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RangeVisit` ADD CONSTRAINT `RangeVisit_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RangeVisit` ADD CONSTRAINT `RangeVisit_rulesId_fkey` FOREIGN KEY (`rulesId`) REFERENCES `RangeRules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RangeRules` ADD CONSTRAINT `RangeRules_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RulesAcceptance` ADD CONSTRAINT `RulesAcceptance_rulesId_fkey` FOREIGN KEY (`rulesId`) REFERENCES `RangeRules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShootingWindow` ADD CONSTRAINT `ShootingWindow_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShootingWindow` ADD CONSTRAINT `ShootingWindow_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `Resource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShootingQuota` ADD CONSTRAINT `ShootingQuota_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShootingQuota` ADD CONSTRAINT `ShootingQuota_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `Resource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Incident` ADD CONSTRAINT `Incident_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClubWeapon` ADD CONSTRAINT `ClubWeapon_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeaponLoan` ADD CONSTRAINT `WeaponLoan_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeaponLoan` ADD CONSTRAINT `WeaponLoan_weaponId_fkey` FOREIGN KEY (`weaponId`) REFERENCES `ClubWeapon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeaponLoan` ADD CONSTRAINT `WeaponLoan_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeaponService` ADD CONSTRAINT `WeaponService_weaponId_fkey` FOREIGN KEY (`weaponId`) REFERENCES `ClubWeapon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmmoStockMovement` ADD CONSTRAINT `AmmoStockMovement_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmmoStockMovement` ADD CONSTRAINT `AmmoStockMovement_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `AmmoProduct`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmmoStockMovement` ADD CONSTRAINT `AmmoStockMovement_rangeDayId_fkey` FOREIGN KEY (`rangeDayId`) REFERENCES `RangeDay`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Course` ADD CONSTRAINT `Course_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseParticipant` ADD CONSTRAINT `CourseParticipant_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseSession` ADD CONSTRAINT `CourseSession_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseSession` ADD CONSTRAINT `CourseSession_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseAttendance` ADD CONSTRAINT `CourseAttendance_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `CourseSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseAttendance` ADD CONSTRAINT `CourseAttendance_participantId_fkey` FOREIGN KEY (`participantId`) REFERENCES `CourseParticipant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseResult` ADD CONSTRAINT `CourseResult_participantId_fkey` FOREIGN KEY (`participantId`) REFERENCES `CourseParticipant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveBoard` ADD CONSTRAINT `LiveBoard_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: bestehende Konten haben ein Passwort gesetzt
UPDATE `User` SET `passwordSetAt` = `createdAt` WHERE `passwordSetAt` IS NULL;

-- Backfill: Totale und Abschlusszeit für die Rangliste
UPDATE `MatchParticipant` p
  SET p.`total` = (SELECT SUM(r.`total`) FROM `MatchResult` r WHERE r.`participantId` = p.`id`)
  WHERE EXISTS (SELECT 1 FROM `MatchResult` r2 WHERE r2.`participantId` = p.`id`);
UPDATE `Match` SET `finishedAt` = `updatedAt` WHERE `status` = 'FINISHED' AND `finishedAt` IS NULL;
